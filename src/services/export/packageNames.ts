import { slugify } from '../../lib/format';
import type { ReceiptRecord } from '../../types/receipt';

/**
 * Pakette fotoğraf adları: "2026-09-14_migros-ticaret-as_337,30.jpg".
 * Aynı ad tekrar ederse sonuna -2, -3 eklenir.
 */
export function photoFileNames(receipts: Pick<ReceiptRecord, 'id' | 'tarih' | 'firma_adi' | 'toplam_tutar'>[]): Map<string, string> {
  const used = new Set<string>();
  const names = new Map<string, string>();
  for (const r of receipts) {
    const base = `${r.tarih}_${slugify(r.firma_adi) || 'fis'}_${r.toplam_tutar.toFixed(2).replace('.', ',')}`;
    let name = `${base}.jpg`;
    for (let n = 2; used.has(name); n++) name = `${base}-${n}.jpg`;
    used.add(name);
    names.set(r.id, name);
  }
  return names;
}
