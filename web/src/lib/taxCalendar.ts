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
