import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../supabase/client';
import { clearPdfCache } from './pdfCache';
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
/** Çıkışta artar: çıkıştan önce başlayan isteğin sonucu yeni oturumun önbelleğine yazılmaz */
let nesil = 0;

export const donemKey = (yon: Yon, from: string) => `${yon}:${from}`;

/** Dönemi önbellekten ya da QNB'den getirir; aynı dönem için süren istek paylaşılır. */
export function donemGetir(yon: Yon, from: string, to: string, force = false): Promise<Donem> {
  const key = donemKey(yon, from);
  const cached = donemCache.get(key);
  if (cached && !force) return Promise.resolve(cached);
  const running = inflight.get(key);
  if (running) return running;
  const basladigi = nesil;
  // Kalıcı kayıt isteği başlatan kullanıcının anahtarına yazılır
  const uid = aktifKullanici();
  const p = listEFaturalar((name, options) => supabase.functions.invoke(name, options), yon, from, to)
    .then((d) => {
      if (basladigi !== nesil) return d;
      qnbDurum.loginFailed = false;
      donemCache.set(key, d);
      void uid.then((u) => {
        if (basladigi === nesil) return kaliciYaz(u, key, d);
      });
      return d;
    })
    .catch((e: unknown) => {
      if (basladigi === nesil && e instanceof EFaturaError && e.loginFailed) qnbDurum.loginFailed = true;
      throw e;
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/*
 * Kalıcı önbellek: QNB yavaş olduğu için her ayın son sonucu telefonda saklanır. Ekranlar açılışta önce
 * bunu gösterir (anında), güncel veri arka planda donemGetir ile gelir.
 */
const KALICI_ONEK = 'efatura-donem:v2:';
/** Çıkışta silinen, hesaba ait e-Fatura kayıtları (eski v1 dahil) */
const SILINECEK_ONEKLER = ['efatura-donem:', 'efatura-ozet:'];

/** Kalıcı kayıtlar kullanıcıya göre ayrılır; aynı telefonda başka hesap öncekinin faturalarını görmez */
async function aktifKullanici(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export interface KaliciDonem {
  donem: Donem;
  /** Kaydedildiği an (ms) */
  at: number;
}

async function kaliciYaz(uid: string | null, key: string, donem: Donem) {
  if (!uid) return;
  try {
    await AsyncStorage.setItem(`${KALICI_ONEK}${uid}:${key}`, JSON.stringify({ donem, at: Date.now() } satisfies KaliciDonem));
  } catch {
    // depolama doluysa önbelleksiz devam
  }
}

/** Dönemin telefonda saklanan son sonucu (yoksa null). Bellek önbelleği varsa onu döner. */
export async function kaliciDonemOku(yon: Yon, from: string): Promise<KaliciDonem | null> {
  const key = donemKey(yon, from);
  const mem = donemCache.get(key);
  if (mem) return { donem: mem, at: Date.now() };
  const uid = await aktifKullanici();
  if (!uid) return null;
  try {
    const raw = await AsyncStorage.getItem(`${KALICI_ONEK}${uid}:${key}`);
    if (!raw) return null;
    const v = JSON.parse(raw) as KaliciDonem;
    return Array.isArray(v?.donem?.faturalar) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Çıkışta e-Fatura önbelleklerini (bellek, PDF, telefonda saklanan dönemler ve özet) ve QNB giriş durumunu
 * temizler; aynı telefonda giriş yapan başka hesap öncekinin faturalarını ya da KDV'sini görmez.
 */
export async function efaturaOnbellekleriniTemizle(): Promise<void> {
  nesil++;
  donemCache.clear();
  inflight.clear();
  qnbDurum.loginFailed = false;
  clearPdfCache();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => SILINECEK_ONEKLER.some((o) => k.startsWith(o)));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // yok say
  }
}
