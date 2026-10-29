import type { GibQrData } from './gibQr';

/** Karekod ekranından forma tek seferlik veri aktarımı (gezinme parametresine JSON koymamak için) */
let pending: GibQrData | null = null;

export function setPendingQr(data: GibQrData) {
  pending = data;
}

/** Bekleyen karekodu alır ve temizler */
export function takePendingQr(): GibQrData | null {
  const d = pending;
  pending = null;
  return d;
}
