import { useSyncExternalStore } from "react";

const LEGACY_KEY = "budget:monthly";

let current: number | null | undefined;
/** Bütçe kullanıcıya özeldir: aynı tarayıcıda başka hesap öncekinin bütçesini görmez */
let owner: string | null = null;
const listeners = new Set<() => void>();

const keyFor = (uid: string) => `${LEGACY_KEY}:${uid}`;

/** Oturum değişince çağrılır (AuthProvider). null: oturum yok, bütçe gösterilmez. */
export function setBudgetOwner(userId: string | null): void {
  if (userId === owner) return;
  owner = userId;
  current = undefined;
  if (userId && typeof window !== "undefined") {
    try {
      // Eski (kullanıcısız) kayıt ilk giren kullanıcıya taşınır, sonra silinir
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        if (localStorage.getItem(keyFor(userId)) === null) localStorage.setItem(keyFor(userId), legacy);
        localStorage.removeItem(LEGACY_KEY);
      }
    } catch {
      // localStorage kapalıysa sessizce geç
    }
  }
  listeners.forEach((l) => l());
}

export function getMonthlyBudget(): number | null {
  if (current !== undefined) return current;
  if (typeof window === "undefined" || !owner) return null;
  try {
    const raw = localStorage.getItem(keyFor(owner));
    const n = raw ? Number(raw) : NaN;
    current = Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    current = null;
  }
  return current;
}

export function setMonthlyBudget(value: number | null): void {
  current = value && value > 0 ? value : null;
  if (typeof window !== "undefined" && owner) {
    try {
      if (current) localStorage.setItem(keyFor(owner), String(current));
      else localStorage.removeItem(keyFor(owner));
    } catch {
      // localStorage kapalıysa sessizce geç
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useMonthlyBudget(): number | null {
  return useSyncExternalStore(subscribe, getMonthlyBudget, () => null);
}
