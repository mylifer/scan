import { deflateSync, strToU8 } from 'fflate';

/**
 * Akış (streaming) ZIP yazıcı: dosyalar eklendikçe çıktıya yazılır, bellekte birikmez.
 *
 * fflate'in akışlı Zip'i boyut ve CRC'yi her dosyanın arkasına ("data descriptor") yazar;
 * macOS Arşiv İzlencesi sıkıştırılmamış (stored) dosyalarda bunu açamıyor ("Hata 0").
 * Burada her dosyanın içeriği eklenirken tam olarak elde olduğundan boyut ve CRC doğrudan
 * dosya başlığına yazılır; böylece her arşiv programı açabilir.
 */
export class ZipStream {
  private offset = 0;
  private entries: { name: Uint8Array; crc: number; csize: number; size: number; method: number; offset: number; time: number; date: number }[] = [];

  constructor(private sink: (chunk: Uint8Array) => void) {}

  /** `compress`: sıkıştırılsın mı (JPEG gibi zaten sıkıştırılmış dosyalarda false). Kazanç yoksa sıkıştırılmadan yazılır. */
  add(name: string, data: Uint8Array, compress: boolean): void {
    const fileName = strToU8(name);
    let body = data;
    let method = 0;
    if (compress) {
      const deflated = deflateSync(data, { level: 6 });
      if (deflated.length < data.length) {
        body = deflated;
        method = 8;
      }
    }
    if (this.entries.length >= 0xffff) throw new Error('Arşivde çok fazla dosya var; daha kısa bir dönem seçin.');
    if (this.offset + 30 + fileName.length + body.length > 0xffffffff) throw new Error('Arşiv 4 GB sınırını aşıyor; daha kısa bir dönem seçin.');

    const { time, date } = dosDateTime(new Date());
    const entry = { name: fileName, crc: crc32(data), csize: body.length, size: data.length, method, offset: this.offset, time, date };
    this.entries.push(entry);

    const h = new Uint8Array(30 + fileName.length);
    const v = new DataView(h.buffer);
    v.setUint32(0, 0x04034b50, true); // yerel dosya başlığı imzası
    v.setUint16(4, 20, true); // gereken sürüm 2.0
    v.setUint16(6, 0x0800, true); // bayrak: dosya adı UTF-8 (data descriptor YOK)
    v.setUint16(8, method, true);
    v.setUint16(10, time, true);
    v.setUint16(12, date, true);
    v.setUint32(14, entry.crc, true);
    v.setUint32(18, entry.csize, true);
    v.setUint32(22, entry.size, true);
    v.setUint16(26, fileName.length, true);
    v.setUint16(28, 0, true);
    h.set(fileName, 30);
    this.write(h);
    this.write(body);
  }

  /** Merkez dizini ve kapanış kaydını yazar. */
  end(): void {
    const start = this.offset;
    for (const e of this.entries) {
      const h = new Uint8Array(46 + e.name.length);
      const v = new DataView(h.buffer);
      v.setUint32(0, 0x02014b50, true); // merkez dizin imzası
      v.setUint16(4, 20, true); // oluşturan sürüm 2.0 (MS-DOS)
      v.setUint16(6, 20, true);
      v.setUint16(8, 0x0800, true);
      v.setUint16(10, e.method, true);
      v.setUint16(12, e.time, true);
      v.setUint16(14, e.date, true);
      v.setUint32(16, e.crc, true);
      v.setUint32(20, e.csize, true);
      v.setUint32(24, e.size, true);
      v.setUint16(28, e.name.length, true);
      // 30: ek alan, 32: yorum, 34: disk, 36: iç öznitelik, 38: dış öznitelik = 0
      v.setUint32(42, e.offset, true);
      h.set(e.name, 46);
      this.write(h);
    }
    const size = this.offset - start;
    if (this.offset > 0xffffffff) throw new Error('Arşiv 4 GB sınırını aşıyor; daha kısa bir dönem seçin.');
    const end = new Uint8Array(22);
    const v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true); // kapanış kaydı imzası
    v.setUint16(8, this.entries.length, true);
    v.setUint16(10, this.entries.length, true);
    v.setUint32(12, size, true);
    v.setUint32(16, start, true);
    this.write(end);
  }

  private write(chunk: Uint8Array) {
    this.sink(chunk);
    this.offset += chunk.length;
  }
}

/** MS-DOS tarih/saat (yerel saat, 2 saniye çözünürlük) */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

let CRC_TABLE: Uint32Array | null = null;

export function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
