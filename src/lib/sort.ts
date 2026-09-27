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
