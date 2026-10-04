import { formatTL } from './format';

/**
 * Aylık özet bildirimi (saf fonksiyon; zamanlama services/reminders/monthlySummary'de).
 * İçinde bulunulan ayın rakamlarıyla, izleyen ayın 1'i 10:00'a kurulur. Uygulama her açıldığında ve
 * fiş eklenip ana sayfaya dönüldüğünde yeniden kurulduğu için rakamlar güncel kalır.
 */
export const MONTHLY_SUMMARY_ID = 'monthly-summary';
export const MONTHLY_SUMMARY_KIND = 'monthly-summary';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export interface MonthTotals {
  total: number;
  kdv: number;
  count: number;
}

export interface MonthlySummaryNotification {
  /** Özeti verilen ay, "2026-09" */
  month: string;
  /** Yerel saatle tetiklenme anı */
  date: Date;
  title: string;
  body: string;
}

/** `now` ayının özeti; izleyen ayın 1'i 10:00 */
export function planMonthlySummary(totals: MonthTotals, now = new Date()): MonthlySummaryNotification {
  const y = now.getFullYear();
  const m = now.getMonth();
  const label = `${AYLAR[m]} ${y}`;
  const body =
    totals.count === 0
      ? `${label} için hiç fiş eklenmedi. Eksik fiş varsa şimdi ekleyebilirsiniz.`
      : `${formatTL(totals.total)} gider · ${formatTL(totals.kdv)} KDV · ${totals.count} fiş. Muhasebe paketini muhasebecinize göndermeyi unutmayın.`;
  return {
    month: `${y}-${String(m + 1).padStart(2, '0')}`,
    date: new Date(y, m + 1, 1, 10, 0, 0, 0),
    title: `${label} özeti`,
    body,
  };
}

/** Bildirimdeki ayın, bugünün ayına göre farkı ("2026-09", Ekim'de → -1) */
export function monthOffset(month: string, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const diff = (Number(match[1]) - now.getFullYear()) * 12 + (Number(match[2]) - 1 - now.getMonth());
  return diff <= 0 ? diff : null;
}
