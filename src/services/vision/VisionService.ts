import type { ReceiptData } from '../../types/receipt';

export interface ReceiptImage {
  /** JPEG verisi, base64 (data: öneki olmadan) */
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
}

/**
 * Uygulamanın fiş okuma için bildiği tek sözleşme.
 * Yeni bir sağlayıcı eklemek = bu arayüzü uygulayan bir adapter yazmak.
 * Ekranlar hiçbir zaman adapter'ları doğrudan import etmez; `getVisionService()` kullanır.
 */
export interface VisionService {
  readonly providerName: string;
  /** Kullanılan model(ler), ör. "gemini-2.5-flash (+3 yedek)" — Ayarlar'da gösterilir */
  readonly modelLabel: string;
  analyzeReceipt(image: ReceiptImage, signal?: AbortSignal): Promise<ReceiptData>;
}

/** busy: sağlayıcı geçici olarak yoğun · quota: kullanım sınırı doldu · other: diğer */
export type VisionErrorKind = 'busy' | 'quota' | 'other';

export class VisionServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly kind: VisionErrorKind = 'other',
  ) {
    super(message);
    this.name = 'VisionServiceError';
  }
}
