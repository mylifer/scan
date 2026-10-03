/** Web sürümünde (tarayıcı) zamanlanmış bildirim yok; ayar gizlenir. */
export const remindersSupported = false;

export async function isReminderEnabled(): Promise<boolean> {
  return false;
}

export async function enableReminder(): Promise<boolean> {
  return false;
}

export async function disableReminder(): Promise<void> {}

export async function refreshTaxReminders(): Promise<void> {}
