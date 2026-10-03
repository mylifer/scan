import { addDays, formatTrDate, taxDeadlines } from './taxCalendar';

/**
 * Vergi takvimi bildirim planı (saf fonksiyon; zamanlama services/reminders/taxReminders'ta).
 * Her ana yükümlülük için iki bildirim: son günden 3 gün önce 10:00 ve son gün 09:00.
 * iOS bir uygulamaya en fazla 64 bekleyen bildirim izin verir; 6 aylık ufuk ~20 bildirim eder,
 * uygulama her açıldığında plan yeniden kurulur.
 */
export interface PlannedReminder {
  id: string;
  /** Yerel tarih, YYYY-MM-DD */
  day: string;
  hour: number;
  title: string;
  body: string;
}

export const REMINDER_PREFIX = 'tax-';
export const HORIZON_DAYS = 183;
export const DAYS_BEFORE = 3;

const SHORT: Record<string, string> = {
  kdv: 'KDV beyannamesi',
  gecici: 'Geçici vergi',
  yillik: 'Yıllık gelir vergisi beyannamesi',
  'yillik-taksit': 'Gelir vergisi 2. taksit',
};

/** @param now yerel saat; geçmişte kalan bildirimler plana alınmaz */
export function planTaxReminders(now: Date): PlannedReminder[] {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const out: PlannedReminder[] = [];
  for (const d of taxDeadlines(today, addDays(today, HORIZON_DAYS))) {
    if (!d.remind) continue;
    const name = SHORT[d.kind] ?? d.title;
    const when = formatTrDate(d.date);
    out.push({
      id: `${REMINDER_PREFIX}${d.kind}-${d.date}-before`,
      day: addDays(d.date, -DAYS_BEFORE),
      hour: 10,
      title: `${name}: ${DAYS_BEFORE} gün kaldı`,
      body: `${d.period} · son gün ${when}. Fişlerinizi kontrol edip muhasebecinize gönderin.`,
    });
    out.push({
      id: `${REMINDER_PREFIX}${d.kind}-${d.date}-due`,
      day: d.date,
      hour: 9,
      title: `${name}: bugün son gün`,
      body: `${d.period} dönemi için son gün bugün (${when}).`,
    });
  }
  return out.filter((r) => localDate(r) > now);
}

/** Planın yerel saatteki tetiklenme anı */
export function localDate(r: Pick<PlannedReminder, 'day' | 'hour'>): Date {
  const [y, m, d] = r.day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, r.hour, 0, 0, 0);
}
