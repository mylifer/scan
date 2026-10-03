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

/**
 * Taslak kopyası: toplu taramada sonradan AI'a gönderilecek, kaydedilince silinir.
 * ~1400px / %65 ≈ 200–400 KB.
 */
export const DRAFT_WIDTH = 1400;
const DRAFT_QUALITY = 0.65;

export interface PreparedImages {
  ai: ReceiptImage;
  /** Yerel dosya URI'si; Kaydet'te Storage'a yüklenir. */
  archiveUri: string;
}

/**
 * AI ve arşiv kopyalarını tek seferde üretir: tam çözünürlüklü fotoğraf (12 MP ≈ 48 MB bellek)
 * yalnızca bir kez açılır; önce iki ayrı paralel açma yapılıyordu.
 */
export async function prepareReceiptImages(photoUri: string): Promise<PreparedImages> {
  const original = await ImageManipulator.manipulate(photoUri).renderAsync();
  try {
    const ai = await saveResized(original, AI_WIDTH, AI_QUALITY, true);
    if (!ai.base64) throw new Error('Görüntü base64 formatına çevrilemedi.');
    const archive = await saveResized(original, ARCHIVE_WIDTH, ARCHIVE_QUALITY, false);
    return { ai: { base64: ai.base64, mimeType: 'image/jpeg' }, archiveUri: archive.uri };
  } finally {
    original.release();
  }
}

export async function prepareAiImage(uri: string, width: number): Promise<ReceiptImage> {
  const result = await render(uri, Math.min(AI_WIDTH, width), AI_QUALITY, true);
  if (!result.base64) throw new Error('Görüntü base64 formatına çevrilemedi.');
  return { base64: result.base64, mimeType: 'image/jpeg' };
}

export async function prepareArchiveImage(uri: string, width: number): Promise<string> {
  return (await render(uri, Math.min(ARCHIVE_WIDTH, width), ARCHIVE_QUALITY, false)).uri;
}

export async function prepareDraftImage(uri: string, width: number): Promise<string> {
  return (await render(uri, Math.min(DRAFT_WIDTH, width), DRAFT_QUALITY, false)).uri;
}

/** Görseli en fazla `maxWidth` genişliğe küçültür (asla büyütmez) ve JPEG olarak kaydeder. */
async function render(uri: string, maxWidth: number, compress: number, base64: boolean) {
  const original = await ImageManipulator.manipulate(uri).renderAsync();
  try {
    return await saveResized(original, maxWidth, compress, base64);
  } finally {
    original.release();
  }
}

type ImageRef = Awaited<ReturnType<ReturnType<typeof ImageManipulator.manipulate>['renderAsync']>>;

/** Açılmış görselden (bırakmadan) küçültülmüş JPEG kopya kaydeder. */
async function saveResized(original: ImageRef, maxWidth: number, compress: number, base64: boolean) {
  const ref = original.width > maxWidth ? await ImageManipulator.manipulate(original).resize({ width: maxWidth }).renderAsync() : original;
  try {
    return await ref.saveAsync({ format: SaveFormat.JPEG, compress, base64 });
  } finally {
    if (ref !== original) ref.release();
  }
}
