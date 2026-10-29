import { supabase } from '../supabase/client';
import { type EFatura, EFaturaError, type Kontrol, listEFaturalar, type Yon } from './qnbEfatura';

/** Bir ayın e-Fatura listesi ve sunucunun notları */
export type Donem = { faturalar: EFatura[]; uyari?: string; bilgi?: string; kontrol?: Kontrol };

/**
 * e-Faturalar ve KDV sekmelerinin ortak önbelleği: uygulama açıkken aynı ay QNB'ye bir kez sorulur.
 * Anahtar: `${yon}:${YYYY-MM-01}`.
 */
export const donemCache = new Map<string, Donem>();

/** QNB girişi başarısız olduysa otomatik yükleme durur (hesap kilitlenmesin); yalnızca elle denenir */
export const qnbDurum = { loginFailed: false };

const inflight = new Map<string, Promise<Donem>>();

export const donemKey = (yon: Yon, from: string) => `${yon}:${from}`;

/** Dönemi önbellekten ya da QNB'den getirir; aynı dönem için süren istek paylaşılır. */
export function donemGetir(yon: Yon, from: string, to: string, force = false): Promise<Donem> {
  const key = donemKey(yon, from);
  const cached = donemCache.get(key);
  if (cached && !force) return Promise.resolve(cached);
  const running = inflight.get(key);
  if (running) return running;
  const p = listEFaturalar((name, options) => supabase.functions.invoke(name, options), yon, from, to)
    .then((d) => {
      qnbDurum.loginFailed = false;
      donemCache.set(key, d);
      return d;
    })
    .catch((e: unknown) => {
      if (e instanceof EFaturaError && e.loginFailed) qnbDurum.loginFailed = true;
      throw e;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
