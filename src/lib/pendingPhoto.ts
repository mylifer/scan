/**
 * Kamera ekranından kontrol ekranına fotoğrafı taşır.
 * Web'de fotoğraf URI'si çok uzun (data:/blob:) olabildiği için URL parametresi yerine bellekte tutulur.
 */
export interface PendingPhoto {
  uri: string;
  width: number;
}

let pending: PendingPhoto | null = null;

export function setPendingPhoto(photo: PendingPhoto) {
  // Web: önceki fotoğrafın blob URL'si (tam çözünürlük, birkaç MB) bırakılsın; yerine yenisi geldi
  if (pending && pending.uri !== photo.uri) revokeBlobUrl(pending.uri);
  pending = photo;
}

/** Yalnızca web'deki blob: URL'lerini bırakır; iPhone dosya yollarına dokunmaz. */
export function revokeBlobUrl(uri: string) {
  if (uri.startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) URL.revokeObjectURL(uri);
}

export function getPendingPhoto(): PendingPhoto | null {
  return pending;
}
