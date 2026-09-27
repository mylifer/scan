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
  pending = photo;
}

export function getPendingPhoto(): PendingPhoto | null {
  return pending;
}
