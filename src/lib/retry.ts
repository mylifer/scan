/** Belirtilen bekleme süreleriyle yeniden dener; son denemenin hatasını fırlatır. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  delaysMs: readonly number[] = [2000, 5000],
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= delaysMs.length; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < delaysMs.length) await wait(delaysMs[i]!);
    }
  }
  throw last;
}

/** Süre içinde sonuçlanmayan işlemi hata ile bitirir (ağ isteği askıda kalıp ekran sonsuza dek dönmesin). */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} ${Math.round(ms / 1000)} saniye içinde yanıt vermedi.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
