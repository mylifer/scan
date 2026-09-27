import { errorMessage } from '../../lib/errors';
import type { ReceiptData } from '../../types/receipt';
import { parseReceiptJson } from './parseReceiptJson';
import { RECEIPT_SYSTEM_PROMPT, RECEIPT_USER_PROMPT } from './receiptPrompt';
import { type ReceiptImage, type VisionService, VisionServiceError } from './VisionService';

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5';

/**
 * Anthropic Messages API'yi doğrudan fetch ile çağırır (React Native'de ek SDK/polyfill gerektirmez).
 * Etkinleştirmek için .env: EXPO_PUBLIC_VISION_PROVIDER=claude ve EXPO_PUBLIC_ANTHROPIC_API_KEY.
 */
export class ClaudeVisionAdapter implements VisionService {
  readonly providerName = 'Claude';

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_CLAUDE_MODEL,
  ) {
    if (!apiKey) throw new VisionServiceError('EXPO_PUBLIC_ANTHROPIC_API_KEY tanımlı değil.');
  }

  async analyzeReceipt(image: ReceiptImage, signal?: AbortSignal): Promise<ReceiptData> {
    let body: { content?: { type: string; text?: string }[]; error?: { message?: string } };
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          // Web sürümünde tarayıcıdan doğrudan çağrıya izin verir
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1024,
          system: RECEIPT_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
                },
                { type: 'text', text: RECEIPT_USER_PROMPT },
              ],
            },
          ],
        }),
      });
      body = await res.json();
      if (!res.ok) {
        const kind = res.status === 429 ? 'quota' : res.status >= 500 ? 'busy' : 'other';
        throw new VisionServiceError(`Claude isteği başarısız: ${body.error?.message ?? `HTTP ${res.status}`}`, body, kind);
      }
    } catch (e) {
      if (e instanceof VisionServiceError) throw e;
      throw new VisionServiceError(`Claude isteği başarısız: ${errorMessage(e) ?? e}`, e);
    }
    const text = body.content?.find((c) => c.type === 'text')?.text;
    if (!text) throw new VisionServiceError('Claude boş yanıt döndürdü.');
    return parseReceiptJson(text);
  }
}
