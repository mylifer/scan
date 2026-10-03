import type { ReceiptData } from '../../types/receipt';
import { parseReceiptJson } from './parseReceiptJson';
import { RECEIPT_JSON_SCHEMA, RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT } from './receiptPrompt';
import { type ReceiptImage, type VisionService, VisionServiceError } from './VisionService';

/** supabase.functions.invoke ile aynı biçim (testte sahtelenebilsin diye dışarıdan verilir) */
export type InvokeFn = (
  name: string,
  options: { body: Record<string, unknown>; signal?: AbortSignal },
) => Promise<{ data: { text?: string; model?: string } | null; error: unknown }>;

/**
 * Fişi Supabase Edge Function (analyze-receipt) üzerinden okur: Gemini anahtarı sunucuda kalır,
 * uygulama paketine girmez. Etkinleştirmek için EXPO_PUBLIC_VISION_PROVIDER=edge.
 */
export class EdgeFunctionVisionAdapter implements VisionService {
  readonly providerName = 'Gemini (sunucu)';
  readonly modelLabel = 'gemini-2.5-flash (+3 yedek, sunucuda)';

  constructor(private readonly invoke: InvokeFn) {}

  async analyzeReceipt(image: ReceiptImage, signal?: AbortSignal): Promise<ReceiptData> {
    const { data, error } = await this.invoke('analyze-receipt', {
      body: { image: image.base64, mimeType: image.mimeType, system: RECEIPT_SYSTEM_PROMPT, user: RECEIPT_USER_PROMPT, schema: RECEIPT_JSON_SCHEMA },
      signal,
    });
    if (error) {
      if (signal?.aborted) throw error;
      const { status, message } = await describeError(error);
      const kind = status === 429 ? 'quota' : status && status >= 500 ? 'busy' : 'other';
      throw new VisionServiceError(friendly(status, message), error, kind);
    }
    if (!data?.text) throw new VisionServiceError('Sunucu boş yanıt döndürdü.');
    return parseReceiptJson(data.text);
  }
}

/** FunctionsHttpError'da context bir Response'tur: durum kodu ve sunucunun hata mesajı oradan okunur */
async function describeError(error: unknown): Promise<{ status?: number; message: string }> {
  const ctx = (error as { context?: { status?: number; json?: () => Promise<{ message?: string }> } })?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : undefined;
  let message = error instanceof Error ? error.message : String(error);
  if (ctx?.json) {
    const body = await ctx.json().catch(() => null);
    if (body?.message) message = body.message;
  }
  return { status, message };
}

function friendly(status: number | undefined, message: string): string {
  if (status === 429) return 'Gemini günlük/dakikalık ücretsiz kullanım sınırına ulaşıldı. Biraz sonra tekrar deneyin.';
  if (status && status >= 500) return 'Google sunucuları şu an çok yoğun. Birkaç dakika sonra tekrar deneyin.';
  if (status === 401) return 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.';
  if (status === 404) return 'Sunucu fonksiyonu (analyze-receipt) bulunamadı. Kurulumu yapılmamış olabilir.';
  return `Fiş okunamadı: ${message}`;
}
