import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ReceiptImage } from '../vision';

/** AI'ın küçük yazıları okuyabilmesi için yeterli çözünürlük. */
const AI_WIDTH = 1600;
const AI_QUALITY = 0.75;

/**
 * Arşiv kopyası: Supabase free plan (1 GB) düşünülerek küçük tutulur.
 * ~900px genişlik + %45 JPEG ≈ 50–120 KB/fiş → 1 GB'a ~10.000 fiş sığar.
 */
const ARCHIVE_WIDTH = 900;
const ARCHIVE_QUALITY = 0.45;

export interface PreparedImages {
  ai: ReceiptImage;
  /** Yerel dosya URI'si; Kaydet'te Storage'a yüklenir. */
  archiveUri: string;
}

export async function prepareReceiptImages(photoUri: string, photoWidth: number): Promise<PreparedImages> {
  const [ai, archive] = await Promise.all([
    render(photoUri, Math.min(AI_WIDTH, photoWidth), AI_QUALITY, true),
    render(photoUri, Math.min(ARCHIVE_WIDTH, photoWidth), ARCHIVE_QUALITY, false),
  ]);
  if (!ai.base64) throw new Error('Görüntü base64 formatına çevrilemedi.');
  return {
    ai: { base64: ai.base64, mimeType: 'image/jpeg' },
    archiveUri: archive.uri,
  };
}

async function render(uri: string, width: number, compress: number, base64: boolean) {
  const ref = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  try {
    return await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64 });
  } finally {
    ref.release();
  }
}
