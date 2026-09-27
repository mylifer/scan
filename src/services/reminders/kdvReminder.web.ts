/** Web sürümünde (tarayıcı) zamanlanmış bildirim yok; ayar gizlenir. */
export const REMINDER_DAY = 25;
export const REMINDER_HOUR = 10;
export const remindersSupported = false;

export async function isReminderEnabled(): Promise<boolean> {
  return false;
}

export async function enableReminder(): Promise<boolean> {
  return false;
}

export async function disableReminder(): Promise<void> {}
