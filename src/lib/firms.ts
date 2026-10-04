import { round2 } from './format';
import type { ReceiptRecord } from '../types/receipt';

/**
 * Firma listesi ve firma özeti. Aynı firma, büyük/küçük harf ve boşluk farkı yok sayılarak
 * tek satırda toplanır ("Migros" ile "MİGROS " aynı). Farklı yazımları kalıcı olarak birleştirmek
 * için Ayarlar → Firma Adlarını Birleştir kullanılır.
 */
export function firmKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR');
}

type Row = Pick<ReceiptRecord, 'firma_adi' | 'tarih' | 'toplam_tutar' | 'toplam_kdv' | 'kdv_yuzde1' | 'kdv_yuzde10' | 'kdv_yuzde20'>;

export interface FirmListItem {
  key: string;
  /** En sık kullanılan yazım */
  name: string;
  count: number;
  total: number;
  kdv: number;
  /** Son fiş tarihi, YYYY-MM-DD */
  last: string;
}

export function aggregateFirms(rows: Row[]): FirmListItem[] {
  const map = new Map<string, FirmListItem & { spellings: Map<string, number> }>();
  for (const r of rows) {
    const key = firmKey(r.firma_adi);
    if (!key) continue;
    let f = map.get(key);
    if (!f) {
      f = { key, name: r.firma_adi.trim(), count: 0, total: 0, kdv: 0, last: r.tarih, spellings: new Map() };
      map.set(key, f);
    }
    f.count++;
    f.total += r.toplam_tutar;
    f.kdv += r.toplam_kdv;
    if (r.tarih > f.last) f.last = r.tarih;
    const s = r.firma_adi.trim();
    f.spellings.set(s, (f.spellings.get(s) ?? 0) + 1);
  }
  return [...map.values()]
    .map(({ spellings, ...f }) => ({
      ...f,
      name: [...spellings.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]![0],
      total: round2(f.total),
      kdv: round2(f.kdv),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'tr'));
}

export interface FirmSummary {
  count: number;
  total: number;
  kdv: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  average: number;
  first: string | null;
  last: string | null;
}

export function summarizeFirm(rows: Row[]): FirmSummary {
  let total = 0;
  let kdv1 = 0;
  let kdv10 = 0;
  let kdv20 = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (const r of rows) {
    total += r.toplam_tutar;
    kdv1 += r.kdv_yuzde1;
    kdv10 += r.kdv_yuzde10;
    kdv20 += r.kdv_yuzde20;
    if (!first || r.tarih < first) first = r.tarih;
    if (!last || r.tarih > last) last = r.tarih;
  }
  return {
    count: rows.length,
    total: round2(total),
    kdv: round2(kdv1 + kdv10 + kdv20),
    kdv1: round2(kdv1),
    kdv10: round2(kdv10),
    kdv20: round2(kdv20),
    average: rows.length ? round2(total / rows.length) : 0,
    first,
    last,
  };
}
