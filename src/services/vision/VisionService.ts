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
  analyzeReceipt(image: ReceiptImage, signal?: AbortSignal): Promise<ReceiptData>;
}

export class VisionServiceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'VisionServiceError';
  }
}
