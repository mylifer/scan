import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/**
 * Aylık gider bütçesi (TL). Bu cihazda saklanır; veritabanı kurulumu gerektirmez.
 * Kullanıcıya özeldir: aynı telefonda başka hesapla girilince öncekinin bütçesi görünmez.
 */
const LEGACY_KEY = 'budget:monthly';
const keyFor = (uid: string) => `${LEGACY_KEY}:${uid}`;

let owner: string | null = null;
let current: number | null | undefined; // undefined: henüz okunmadı
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

/** Oturum değişince çağrılır (useAuth). null: oturum yok, bütçe gösterilmez. */
export async function setBudgetOwner(userId: string | null): Promise<void> {
  if (userId === owner) return;
  owner = userId;
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
}

export async function setMonthlyBudget(value: number | null): Promise<void> {
  current = value && value > 0 ? value : null;
  try {
    if (owner) {
      if (current) await AsyncStorage.setItem(keyFor(owner), String(current));
      else await AsyncStorage.removeItem(keyFor(owner));
    }
  } catch {
    // Depolama kapalı/dolu: değer bu oturumda geçerli kalır, kaydetme sessizce atlanır
  } finally {
    notify();
  }
}

export function useMonthlyBudget(): number | null {
  const [value, setValue] = useState<number | null>(current ?? null);
  useEffect(() => {
    let alive = true;
    load().then((v) => alive && setValue(v));
    listeners.add(setValue);
    return () => {
      alive = false;
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
