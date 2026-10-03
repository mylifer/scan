import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** Aylık gider bütçesi (TL). Bu cihazda saklanır; veritabanı kurulumu gerektirmez. */
const KEY = 'budget:monthly';
let current: number | null | undefined; // undefined: henüz okunmadı
const listeners = new Set<(v: number | null) => void>();

async function load(): Promise<number | null> {
  if (current !== undefined) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    current = Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    current = null;
  }
  return current;
}

export async function setMonthlyBudget(value: number | null): Promise<void> {
  current = value && value > 0 ? value : null;
  try {
    if (current) await AsyncStorage.setItem(KEY, String(current));
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Depolama kapalı/dolu: değer bu oturumda geçerli kalır, kaydetme sessizce atlanır
  } finally {
    listeners.forEach((l) => l(current ?? null));
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
