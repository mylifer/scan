import { round2 } from './format';

export interface MonthPoint {
  /** "2026-09" */
  key: string;
  /** Ay göstergesinden fark: 0 = bu ay, -1 = geçen ay */
  offset: number;
  /** "Eylül 2026" */
  label: string;
  /** Tek harf eksen etiketi ("E") */
  short: string;
  total: number;
  kdv: number;
}

/** Son `months` ay için boş (sıfır) seriyi, eskiden yeniye üretir. */
export function emptySeries(months: number, now = new Date()): MonthPoint[] {
  return Array.from({ length: months }, (_, i) => {
    const offset = i - (months - 1);
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const label = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      offset,
      label: label.charAt(0).toLocaleUpperCase('tr-TR') + label.slice(1),
      short: d.toLocaleDateString('tr-TR', { month: 'short' }).charAt(0).toLocaleUpperCase('tr-TR'),
      total: 0,
      kdv: 0,
    };
  });
}

/** Fiş satırlarını aylara toplar. Seri dışındaki tarihler yok sayılır. */
export function buildMonthlySeries(
  rows: { tarih: string; toplam_tutar: number; toplam_kdv: number }[],
  months = 12,
  now = new Date(),
): MonthPoint[] {
  const series = emptySeries(months, now);
  const byKey = new Map(series.map((p) => [p.key, p]));
  for (const r of rows) {
    const p = byKey.get(r.tarih.slice(0, 7));
    if (!p) continue;
    p.total += r.toplam_tutar;
    p.kdv += r.toplam_kdv;
  }
  for (const p of series) {
    p.total = round2(p.total);
    p.kdv = round2(p.kdv);
  }
  return series;
}

/** Eksen için "yuvarlak" üst sınır; çubuklar alanı iyi kullansın diye sık adımlar (ör. 4.300 → 5.000, 6.100 → 8.000) */
export function niceMax(value: number): number {
  if (value <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (value <= m * exp) return m * exp;
  return 10 * exp;
}

/** Eksen etiketi: 5000 → "5 B", 12500 → "12,5 B", 800 → "800" */
export function compactTL(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
  if (value >= 1000) return `${(value / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B`;
  return String(Math.round(value));
}
