import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { BUTCE_ESITLEME_ARALIGI_MS, type ButceUzak, butceEsitle } from './budgetSync';

/**
 * Aylık gider bütçesi (TL). Kullanıcıya özeldir: aynı telefonda başka hesapla girilince öncekinin bütçesi görünmez.
 * Cihazda saklanır (anında açılış, internetsiz kullanım) ve 008 kurulumu yapıldıysa bulutla (user_settings)
 * eşitlenir; böylece web ve telefon aynı bütçeyi görür. Bulut erişimi setBudgetRemote ile verilir (useAuth).
 */
const LEGACY_KEY = 'budget:monthly';
const keyFor = (uid: string) => `${LEGACY_KEY}:${uid}`;
/** Buluta yazılamamış (internetsiz kaydedilmiş) değişiklik işareti */
const pendingKeyFor = (uid: string) => `${LEGACY_KEY}:${uid}:pending`;

let owner: string | null = null;
let current: number | null | undefined; // undefined: henüz okunmadı
let remote: ButceUzak | null = null;
let lastSync = 0;
let syncing: Promise<void> | null = null;
const listeners = new Set<(v: number | null) => void>();

function notify() {
  listeners.forEach((l) => l(current ?? null));
}

async function load(): Promise<number | null> {
  if (current !== undefined) return current;
  const uid = owner;
  if (!uid) return null;
  let value: number | null = null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(uid));
    const n = raw ? Number(raw) : NaN;
    value = Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    value = null;
  }
  // Okuma sürerken oturum değiştiyse eski kullanıcının değeri yazılmaz
  if (owner !== uid) return current ?? null;
  current = value;
  return current;
}

async function writeLocal(uid: string, value: number | null, pending: boolean): Promise<void> {
  try {
    if (value) await AsyncStorage.setItem(keyFor(uid), String(value));
    else await AsyncStorage.removeItem(keyFor(uid));
    if (pending) await AsyncStorage.setItem(pendingKeyFor(uid), '1');
    else await AsyncStorage.removeItem(pendingKeyFor(uid));
  } catch {
    // Depolama kapalı/dolu: değer bu oturumda geçerli kalır, kaydetme sessizce atlanır
  }
}

/** Bulut erişimini verir (uygulama açılışında; testlerde verilmez) */
export function setBudgetRemote(r: ButceUzak | null): void {
  remote = r;
  lastSync = 0;
}

/**
 * Buluttaki bütçeyi okur ya da bekleyen değişikliği yazar. `force` değilse en fazla dakikada bir çalışır.
 * Hiçbir zaman hata fırlatmaz.
 */
export function syncBudget(force = false): Promise<void> {
  if (!remote || !owner) return Promise.resolve();
  if (syncing) return syncing;
  if (!force && Date.now() - lastSync < BUTCE_ESITLEME_ARALIGI_MS) return Promise.resolve();
  const uid = owner;
  const r = remote;
  syncing = (async () => {
    try {
      const cihaz = await load();
      let pending = false;
      try {
        pending = (await AsyncStorage.getItem(pendingKeyFor(uid))) === '1';
      } catch {
        pending = false;
      }
      const sonuc = await butceEsitle(r, uid, cihaz, pending);
      if (!sonuc || owner !== uid) return;
      lastSync = Date.now();
      // Eşitleme sürerken kullanıcı değer girdiyse onunki geçerli kalır (o da kendi yazmasını yapar)
      if (current !== cihaz) return;
      await writeLocal(uid, sonuc.deger, sonuc.bekleyen);
      if (owner !== uid) return;
      if (sonuc.deger !== current) {
        current = sonuc.deger;
        notify();
      }
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Oturum değişince çağrılır (useAuth). null: oturum yok, bütçe gösterilmez. */
export async function setBudgetOwner(userId: string | null): Promise<void> {
  if (userId === owner) return;
  owner = userId;
  lastSync = 0;
  current = userId ? undefined : null;
  if (userId) {
    try {
      // Eski (kullanıcısız) kayıt ilk giren kullanıcıya taşınır, sonra silinir
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        if ((await AsyncStorage.getItem(keyFor(userId))) === null) await AsyncStorage.setItem(keyFor(userId), legacy);
        await AsyncStorage.removeItem(LEGACY_KEY);
      }
    } catch {
      // Depolama kapalı: taşıma atlanır
    }
    await load();
  }
  notify();
  void syncBudget(true);
}

export async function setMonthlyBudget(value: number | null): Promise<void> {
  current = value && value > 0 ? value : null;
  const uid = owner;
  notify();
  if (!uid) return;
  // Önce "bekleyen" olarak yazılır; bulut kaydı başarılı olursa işaret kalkar
  await writeLocal(uid, current, !!remote);
  if (!remote) return;
  // Süren bir okuma bu değeri görmeden bitmiş olabilir; ardından bekleyen değer yazılır
  if (syncing) await syncing;
  await syncBudget(true);
}

export function useMonthlyBudget(): number | null {
  const [value, setValue] = useState<number | null>(current ?? null);
  useEffect(() => {
    let alive = true;
    load().then((v) => alive && setValue(v));
    listeners.add(setValue);
    // Başka cihazda değiştirilmiş olabilir (dakikada en fazla bir okuma)
    void syncBudget();
    return () => {
      alive = false;
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
