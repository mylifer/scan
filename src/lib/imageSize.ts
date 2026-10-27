export interface ImageSize {
  width: number;
  height: number;
  ext: 'jpeg' | 'png';
}

/**
 * JPEG ya da PNG baytlarından piksel boyutunu okur (görseli açmadan, yalnızca başlığa bakarak).
 * Tanınmayan ya da bozuk dosyada null döner.
 */
export function imageSize(b: Uint8Array): ImageSize | null {
  // PNG: 8 baytlık imza, ardından IHDR (genişlik 16., yükseklik 20. bayttan)
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const width = u32(b, 16);
    const height = u32(b, 20);
    return width && height ? { width, height, ext: 'png' } : null;
  }
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  // JPEG: işaretçileri (marker) sırayla atla, ilk SOF işaretçisinde boyut yazar
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // dolgu baytı
      continue;
    }
    // Uzunluk alanı olmayan işaretçiler
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    // SOF0..SOF15; C4 (DHT), C8 (JPG), CC (DAC) SOF değildir
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (b[i + 5] << 8) | b[i + 6];
      const width = (b[i + 7] << 8) | b[i + 8];
      return width && height ? { width, height, ext: 'jpeg' } : null;
    }
    if (marker === 0xda || len < 2) return null; // görüntü verisi başladı, SOF bulunamadı
    i += 2 + len;
  }
  return null;
}

function u32(b: Uint8Array, at: number): number {
  return ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
}
