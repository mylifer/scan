import AsyncStorage from '@react-native-async-storage/async-storage';

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
      void kaliciYaz(key, d);
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

/*
 * Kalıcı önbellek: QNB yavaş olduğu için her ayın son sonucu telefonda saklanır. Ekranlar açılışta önce
 * bunu gösterir (anında), güncel veri arka planda donemGetir ile gelir.
 */
const KALICI_ONEK = 'efatura-donem:v1:';

export interface KaliciDonem {
  donem: Donem;
  /** Kaydedildiği an (ms) */
  at: number;
}

async function kaliciYaz(key: string, donem: Donem) {
  try {
    await AsyncStorage.setItem(KALICI_ONEK + key, JSON.stringify({ donem, at: Date.now() } satisfies KaliciDonem));
  } catch {
    // depolama doluysa önbelleksiz devam
  }
}

/** Dönemin telefonda saklanan son sonucu (yoksa null). Bellek önbelleği varsa onu döner. */
export async function kaliciDonemOku(yon: Yon, from: string): Promise<KaliciDonem | null> {
  const key = donemKey(yon, from);
  const mem = donemCache.get(key);
  if (mem) return { donem: mem, at: Date.now() };
  try {
    const raw = await AsyncStorage.getItem(KALICI_ONEK + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as KaliciDonem;
    return Array.isArray(v?.donem?.faturalar) ? v : null;
  } catch {
    return null;
  }
}
