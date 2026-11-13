import { useEffect, useSyncExternalStore } from "react";
import { BUTCE_ESITLEME_ARALIGI_MS, type ButceUzak, butceEsitle } from "@shared/lib/budgetSync";

/**
 * Aylık bütçe. Tarayıcıda saklanır (anında açılış) ve 008 kurulumu yapıldıysa bulutla (user_settings) eşitlenir;
 * telefon ve web aynı bütçeyi görür. Bulut erişimi setBudgetRemote ile verilir (AuthProvider).
 */
const LEGACY_KEY = "budget:monthly";

let current: number | null | undefined;
let remote: ButceUzak | null = null;
let lastSync = 0;
let syncing: Promise<void> | null = null;
/** Bütçe kullanıcıya özeldir: aynı tarayıcıda başka hesap öncekinin bütçesini görmez */
let owner: string | null = null;
const listeners = new Set<() => void>();

const keyFor = (uid: string) => `${LEGACY_KEY}:${uid}`;
/** Buluta yazılamamış (internetsiz kaydedilmiş) değişiklik işareti */
const pendingKeyFor = (uid: string) => `${LEGACY_KEY}:${uid}:pending`;

function notify() {
  listeners.forEach((l) => l());
}

function writeLocal(uid: string, value: number | null, pending: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(keyFor(uid), String(value));
    else localStorage.removeItem(keyFor(uid));
    if (pending) localStorage.setItem(pendingKeyFor(uid), "1");
    else localStorage.removeItem(pendingKeyFor(uid));
  } catch {
    // localStorage kapalıysa sessizce geç
  }
}

function isPending(uid: string): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(pendingKeyFor(uid)) === "1";
  } catch {
    return false;
  }
}

/** Bulut erişimini verir (AuthProvider; testlerde verilmez) */
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
  const cihaz = getMonthlyBudget();
  syncing = (async () => {
    try {
      const sonuc = await butceEsitle(r, uid, cihaz, isPending(uid));
      if (!sonuc || owner !== uid) return;
      lastSync = Date.now();
      // Eşitleme sürerken kullanıcı değer girdiyse onunki geçerli kalır
      if (getMonthlyBudget() !== cihaz) return;
      writeLocal(uid, sonuc.deger, sonuc.bekleyen);
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

/** Oturum değişince çağrılır (AuthProvider). null: oturum yok, bütçe gösterilmez. */
export function setBudgetOwner(userId: string | null): void {
  if (userId === owner) return;
  owner = userId;
  lastSync = 0;
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
  notify();
  void syncBudget(true);
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
  const uid = owner;
  if (uid) writeLocal(uid, current, !!remote);
  notify();
  if (uid && remote) {
    // Süren bir okuma bu değeri görmeden bitmiş olabilir; ardından bekleyen değer yazılır
    void (syncing ?? Promise.resolve()).then(() => syncBudget(true));
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useMonthlyBudget(): number | null {
  // Başka cihazda değiştirilmiş olabilir (dakikada en fazla bir okuma)
  useEffect(() => {
    void syncBudget();
  }, []);
  return useSyncExternalStore(subscribe, getMonthlyBudget, () => null);
}
