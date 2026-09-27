/**
 * Türkiye saati (UTC+3, yaz saati uygulaması yok) ile planlama yardımcıları.
 *
 * Fiyatlar saate göre değişmez; ancak sağlayıcıların yoğunluğu değişir. ABD'de gece olan
 * saatler (Türkiye'de sabah ~10:00–14:00) genellikle daha sakindir. İleride ücretli API'ye
 * geçildiğinde, sağlayıcıların yarı fiyatına çalışan "batch" modu da bu planlamaya bağlanabilir.
 */
const TR_OFFSET_HOURS = 3;

export const SCHEDULE_HOURS = [3, 7, 10, 13] as const;
export const RECOMMENDED_HOUR = 10;

/** Şu andan sonraki ilk "saat:00" (Türkiye saati) anı. */
export function nextRunAt(hourTr: number, now = new Date()): Date {
  const target = new Date(now);
  target.setUTCHours(hourTr - TR_OFFSET_HOURS, 0, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target;
}

/** "Bugün 10:00" / "Yarın 03:00" / "28 Eylül 10:00" */
export function formatRunAt(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const tr = (x: Date) => new Date(x.getTime() + TR_OFFSET_HOURS * 3600_000);
  const dt = tr(d);
  const today = tr(now);
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  const dayDiff = Math.round(
    (Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()) -
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
      86_400_000,
  );
  const day =
    dayDiff === 0
      ? 'Bugün'
      : dayDiff === 1
        ? 'Yarın'
        : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
  return `${day} ${hh}:${mm}`;
}
