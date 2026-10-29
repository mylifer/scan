import type { EFatura } from '../../supabase/functions/qnb-efatura/soap';

export const EFATURA_SORTS = [
  { key: 'yeni', label: 'En Yeni' },
  { key: 'eski', label: 'En Eski' },
  { key: 'tutar-yuksek', label: 'En Yüksek Tutar' },
  { key: 'tutar-dusuk', label: 'En Düşük Tutar' },
  { key: 'kdv-yuksek', label: 'En Yüksek KDV' },
  { key: 'firma', label: 'Firma (A–Z)' },
] as const;

export type EFaturaSort = (typeof EFATURA_SORTS)[number]['key'];

/** Seçilen sıralamanın telefonda saklandığı anahtar */
export const EFATURA_SORT_KEY = 'efatura:siralama';

export function isEFaturaSort(v: unknown): v is EFaturaSort {
  return EFATURA_SORTS.some((o) => o.key === v);
}

/** Aynı tarihte belge numarası sırası korunur (yeni → eski) */
const tarihYeni = (a: EFatura, b: EFatura) => b.tarih.localeCompare(a.tarih) || b.belgeNo.localeCompare(a.belgeNo);

/** Fatura listesini sıralar (yeni dizi döner). */
export function sortEFaturalar(list: EFatura[], key: EFaturaSort): EFatura[] {
  const out = [...list];
  switch (key) {
    case 'eski':
      return out.sort((a, b) => tarihYeni(b, a));
    case 'tutar-yuksek':
      return out.sort((a, b) => b.tutar - a.tutar || tarihYeni(a, b));
    case 'tutar-dusuk':
      return out.sort((a, b) => a.tutar - b.tutar || tarihYeni(a, b));
    case 'kdv-yuksek':
      // KDV bilgisi olmayanlar sona
      return out.sort((a, b) => (b.kdv ?? -1) - (a.kdv ?? -1) || tarihYeni(a, b));
    case 'firma':
      return out.sort((a, b) => a.unvan.localeCompare(b.unvan, 'tr', { sensitivity: 'base' }) || tarihYeni(a, b));
    default:
      return out.sort(tarihYeni);
  }
}
