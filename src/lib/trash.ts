/** Çöp kutusundaki fişler bu kadar gün sonra kalıcı olarak silinir */
export const TRASH_DAYS = 30;

const DAY = 86_400_000;

/** Kalıcı silinmeye kalan tam gün (0 = bugün siliniyor) */
export function trashDaysLeft(deletedAt: string, now = new Date()): number {
  const t = Date.parse(deletedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t + TRASH_DAYS * DAY - now.getTime()) / DAY));
}

/** Bu andan önce silinenlerin süresi dolmuştur (ISO) */
export function trashCutoff(now = new Date()): string {
  return new Date(now.getTime() - TRASH_DAYS * DAY).toISOString();
}

export function trashLeftLabel(days: number): string {
  if (days <= 0) return 'Bugün kalıcı olarak silinecek';
  if (days === 1) return 'Yarın kalıcı olarak silinecek';
  return `${days} gün sonra kalıcı olarak silinecek`;
}
