import { GoogleGenAI } from '@google/genai';

import type { ReceiptData } from '../../types/receipt';
import { parseReceiptJson } from './parseReceiptJson';
import { RECEIPT_JSON_SCHEMA, RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT } from './receiptPrompt';
import { type ReceiptImage, type VisionService, VisionServiceError } from './VisionService';

/**
 * En yeni model (gemini-flash-latest) ücretsiz planda sık sık "yoğun" (503) hatası veriyor.
 * Eylül 2026 ölçümünde bu modeller hem doğru okudu hem de erişilebilir kaldı.
 * Her modelin ayrı ücretsiz kotası olduğu için zincir günlük kapasiteyi de artırır.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Seçilen model yoğunsa sırayla denenecek yedek modeller. */
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];

/** Geçici hatalar: aşırı yoğunluk (503), kota/hız sınırı (429), sunucu hatası (500) */
const TRANSIENT_STATUS = new Set([429, 500, 502, 503, 504]);

export class GeminiVisionAdapter implements VisionService {
  readonly providerName = 'Gemini';
  private readonly client: GoogleGenAI;
  private readonly models: string[];

  constructor(apiKey: string, model: string = DEFAULT_GEMINI_MODEL) {
    if (!apiKey) throw new VisionServiceError('EXPO_PUBLIC_GEMINI_API_KEY tanımlı değil.');
    this.client = new GoogleGenAI({
      apiKey,
      // Her model için geçici hatalarda 1 tekrar; sonra hızlıca sıradaki modele geçilir
      httpOptions: { retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 2 } },
    });
    this.models = [...new Set([model, ...FALLBACK_MODELS])];
  }

  async analyzeReceipt(image: ReceiptImage, signal?: AbortSignal): Promise<ReceiptData> {
    let lastError: unknown;
    for (const model of this.models) {
      try {
        const text = await this.generate(model, image, signal);
        return parseReceiptJson(text);
      } catch (e) {
        if (signal?.aborted) throw e;
        lastError = e;
        // Geçici bir sunucu sorunuysa sıradaki modele geç; değilse (ör. geçersiz anahtar) hemen bildir
        if (!TRANSIENT_STATUS.has(httpStatus(e) ?? 0)) break;
      }
    }
    const status = httpStatus(lastError);
    const kind = status === 429 ? 'quota' : TRANSIENT_STATUS.has(status ?? 0) ? 'busy' : 'other';
    throw new VisionServiceError(friendlyMessage(lastError), lastError, kind);
  }

  private async generate(model: string, image: ReceiptImage, signal?: AbortSignal): Promise<string> {
    const response = await this.client.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: RECEIPT_USER_PROMPT }],
        },
      ],
      config: {
        systemInstruction: RECEIPT_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseJsonSchema: RECEIPT_JSON_SCHEMA,
        temperature: 0,
        abortSignal: signal,
      },
    });
    if (!response.text) throw new VisionServiceError('Gemini boş yanıt döndürdü.');
    return response.text;
  }
}

/** SDK hatasından HTTP durum kodunu çıkarır (status alanı ya da mesajdaki "code": 503). */
function httpStatus(e: unknown): number | undefined {
  const status = (e as { status?: unknown })?.status;
  if (typeof status === 'number') return status;
  const match = String((e as Error)?.message ?? '').match(/"code"\s*:\s*(\d{3})/);
  return match ? Number(match[1]) : undefined;
}

function friendlyMessage(e: unknown): string {
  if (e instanceof VisionServiceError) return e.message;
  const status = httpStatus(e);
  if (status) {
    if (status === 503 || status === 500 || status === 502 || status === 504) {
      return 'Google sunucuları şu an çok yoğun. Birkaç dakika sonra "Tekrar dene"ye basın ya da bilgileri elle doldurun.';
    }
    if (status === 429) {
      return 'Gemini günlük/dakikalık ücretsiz kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyin.';
    }
    if (status === 401 || status === 403) {
      return `Gemini anahtarı geçersiz ya da yetkisiz (${status}).`;
    }
  }
  return `Gemini isteği başarısız: ${(e as Error)?.message ?? e}`;
}
