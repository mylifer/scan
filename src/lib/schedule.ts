/**
 * Türkiye saati (UTC+3, yaz saati uygulaması yok) ile planlama yardımcıları.
 *
 * Fiyatlar saate göre değişmez; ancak sağlayıcıların yoğunluğu değişir. ABD'de gece olan
 * saatler (Türkiye'de sabah ~10:00–14:00) genellikle daha sakindir. İleride ücretli API'ye
 * geçildiğinde, sağlayıcıların yarı fiyatına çalışan "batch" modu da bu planlamaya bağlanabilir.
 */
const TR_OFFSET_HOURS = 3;

/**
 * Gemini ücretsiz kotasının yenilendiği saat (Türkiye): Pasifik gece yarısı. ABD yaz saatinde 10:00, kışın 11:00.
 * Saat dilimi bilgisi alınamazsa 10.
 */
export function quotaResetHourTr(now = new Date()): number {
  try {
    const la = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', hourCycle: 'h23' }).format(now));
    if (!Number.isFinite(la)) return 10;
    const offset = ((la - now.getUTCHours() + 24) % 24) - 24; // -7 (yaz) ya da -8 (kış)
    return (TR_OFFSET_HOURS - offset) % 24;
  } catch {
    return 10;
  }
}

/** Planlama seçenekleri; önerilen saat kotanın yenilendiği saattir (hem sakin hem hak dolu) */
export function scheduleHours(now = new Date()): number[] {
  return [3, 7, quotaResetHourTr(now), 13];
}
export const recommendedHour = (now = new Date()) => quotaResetHourTr(now);

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
