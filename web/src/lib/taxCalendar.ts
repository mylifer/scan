import { daysUntil, type TaxDeadline } from "@shared/lib/taxCalendar";

export interface FilterTaxDeadlinesOptions {
  kind?: string;
  showPast?: boolean;
  today: string;
}

/**
 * Vergi takvimi yükümlülük listesini tür ve geçmiş tarih durumuna göre filtreler.
 * Varsayılan olarak geçmiş satırlar (daysUntil < 0) gösterilmez.
 */
export function filterTaxDeadlines(
  deadlines: TaxDeadline[],
  options: FilterTaxDeadlinesOptions
): TaxDeadline[] {
  const { kind = "all", showPast = false, today } = options;
  return deadlines.filter((d) => {
    if (kind !== "all" && d.kind !== kind) return false;
    if (!showPast && daysUntil(d.date, today) < 0) return false;
    return true;
  });
}

/**
 * Seçili tür filtresine göre geçmiş (tamamlanmış) yükümlülük sayısını hesaplar.
 */
export function countPastDeadlines(
  deadlines: TaxDeadline[],
  options: { kind?: string; today: string }
): number {
  const { kind = "all", today } = options;
  return deadlines.filter((d) => {
    if (kind !== "all" && d.kind !== kind) return false;
    return daysUntil(d.date, today) < 0;
  }).length;
}

/**
 * Takvimin bayram verisi 2026'dan başlar (`@shared/lib/taxCalendar`); daha eski yıllarda dini bayram
 * kaydırmaları eksik kalacağı için seçenek olarak sunulmaz. Doğrulanmış verinin sonrasındaki yıllarda
 * takvim yine hesaplanır, satırlara "henüz doğrulanmadı" notu eklenir.
 */
export const TAX_CALENDAR_FIRST_YEAR = 2026;

/** Yıl seçenekleri: geçen yıl, bu yıl ve gelecek yıl (bayram verisi olmayan eski yıllar hariç) */
export function taxYearOptions(today: string): string[] {
  const y = Number(today.slice(0, 4));
  const years: string[] = [];
  for (let yr = y - 1; yr <= y + 1; yr++) {
    if (yr >= TAX_CALENDAR_FIRST_YEAR) years.push(String(yr));
  }
  return years;
}
