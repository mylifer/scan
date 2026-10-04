/** Web sürümünde (tarayıcı) zamanlanmış bildirim yok; ayar gizlenir. */
export async function isMonthlySummaryEnabled(): Promise<boolean> {
  return false;
}

export async function enableMonthlySummary(): Promise<boolean> {
  return false;
}

export async function disableMonthlySummary(): Promise<void> {}

export async function updateMonthlySummary(): Promise<void> {}
