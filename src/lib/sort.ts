import type { ReceiptRecord } from '../types/receipt';

export const SORT_OPTIONS = [
  { key: 'newest', label: 'En Yeni' },
  { key: 'oldest', label: 'En Eski' },
  { key: 'highest', label: 'En Yüksek Tutar' },
  { key: 'lowest', label: 'En Düşük Tutar' },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]['key'];

type Sortable = Pick<ReceiptRecord, 'tarih' | 'created_at' | 'toplam_tutar'>;

const byDate = (a: Sortable, b: Sortable) => a.tarih.localeCompare(b.tarih) || a.created_at.localeCompare(b.created_at);

/** Fiş listesini sıralar (yeni dizi döner; aynı tarihte kayıt sırası korunur). */
export function sortReceipts<T extends Sortable>(rows: T[], key: SortKey): T[] {
  const out = [...rows];
  switch (key) {
    case 'oldest':
      return out.sort(byDate);
    case 'highest':
      return out.sort((a, b) => b.toplam_tutar - a.toplam_tutar || byDate(b, a));
    case 'lowest':
      return out.sort((a, b) => a.toplam_tutar - b.toplam_tutar || byDate(b, a));
    default:
      return out.sort((a, b) => byDate(b, a));
  }
}

export interface MonthGroup<T> {
  /** "2026-09" */
  key: string;
  /** "Eylül 2026" */
  label: string;
  items: T[];
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Sıralı listeyi (tarihe göre) ardışık aylara böler; sıra korunur. */
export function groupByMonth<T extends Pick<ReceiptRecord, 'tarih'>>(rows: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  for (const r of rows) {
    const key = r.tarih.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: `${AYLAR[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }
  return groups;
}
