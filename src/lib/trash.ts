/** Çöp kutusundaki fişler bu kadar gün sonra kalıcı olarak silinir */
export const TRASH_DAYS = 30;

const DAY = 86_400_000;

/** Kalıcı silinmeye kalan takvim günü, yerel saatle (0 = bugün, 1 = yarın) */
export function trashDaysLeft(deletedAt: string, now = new Date()): number {
  const t = Date.parse(deletedAt);
  if (!Number.isFinite(t)) return 0;
  const expiry = new Date(t + TRASH_DAYS * DAY);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((startOf(expiry) - startOf(now)) / DAY));
}

/** Bu andan önce silinenlerin süresi dolmuştur (ISO) */
export function trashCutoff(now = new Date()): string {
  return new Date(now.getTime() - TRASH_DAYS * DAY).toISOString();
}

export function trashLeftLabel(days: number): string {
  if (days <= 0) return 'Bugün silinecek';
  if (days === 1) return 'Yarın silinecek';
  return `${days} gün kaldı`;
}
