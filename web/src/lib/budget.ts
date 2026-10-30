import { useSyncExternalStore } from "react";

const KEY = "budget:monthly";

let current: number | null | undefined;
const listeners = new Set<() => void>();

export function getMonthlyBudget(): number | null {
  if (current !== undefined) return current;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    const n = raw ? Number(raw) : NaN;
    current = Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    current = null;
  }
  return current;
}

export function setMonthlyBudget(value: number | null): void {
  current = value && value > 0 ? value : null;
  if (typeof window !== "undefined") {
    try {
      if (current) localStorage.setItem(KEY, String(current));
      else localStorage.removeItem(KEY);
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
