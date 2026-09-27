import { ClaudeVisionAdapter } from './ClaudeVisionAdapter';
import { GeminiVisionAdapter } from './GeminiVisionAdapter';
import { type VisionService, VisionServiceError } from './VisionService';

export type { ReceiptImage, VisionService } from './VisionService';
export { VisionServiceError } from './VisionService';

let instance: VisionService | null = null;

/**
 * Uygulamanın geri kalanı yalnızca bu fonksiyonu kullanır.
 * Sağlayıcı .env içindeki EXPO_PUBLIC_VISION_PROVIDER ile seçilir.
 */
export function getVisionService(): VisionService {
  if (instance) return instance;

  const provider = (process.env.EXPO_PUBLIC_VISION_PROVIDER ?? 'gemini').toLowerCase();
  switch (provider) {
    case 'gemini':
      instance = new GeminiVisionAdapter(
        process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
        process.env.EXPO_PUBLIC_GEMINI_MODEL || undefined,
      );
      break;
    case 'claude':
      instance = new ClaudeVisionAdapter(
        process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
        process.env.EXPO_PUBLIC_CLAUDE_MODEL || undefined,
      );
      break;
    default:
      throw new VisionServiceError(`Bilinmeyen görüntü sağlayıcısı: ${provider}`);
  }
  return instance;
}
