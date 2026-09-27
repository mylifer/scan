import { GoogleGenAI } from '@google/genai';

import type { ReceiptData } from '../../types/receipt';
import { parseReceiptJson } from './parseReceiptJson';
import { RECEIPT_JSON_SCHEMA, RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT } from './receiptPrompt';
import { type ReceiptImage, type VisionService, VisionServiceError } from './VisionService';

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export class GeminiVisionAdapter implements VisionService {
  readonly providerName = 'Gemini';
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string = DEFAULT_GEMINI_MODEL,
  ) {
    if (!apiKey) throw new VisionServiceError('EXPO_PUBLIC_GEMINI_API_KEY tanımlı değil.');
    this.client = new GoogleGenAI({ apiKey });
  }

  async analyzeReceipt(image: ReceiptImage, signal?: AbortSignal): Promise<ReceiptData> {
    let text: string | undefined;
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: image.mimeType, data: image.base64 } },
              { text: RECEIPT_USER_PROMPT },
            ],
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
      text = response.text;
    } catch (e) {
      throw new VisionServiceError(`Gemini isteği başarısız: ${(e as Error).message ?? e}`, e);
    }
    if (!text) throw new VisionServiceError('Gemini boş yanıt döndürdü.');
    return parseReceiptJson(text);
  }
}
