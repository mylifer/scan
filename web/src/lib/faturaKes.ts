import type { KesInvokeFn, Taraf } from "@shared/services/efatura/faturaKes";
import { supabase } from "@/lib/supabase";

export const kesInvoker: KesInvokeFn = async (name, options) => {
  const { data, error } = await supabase.functions.invoke(name, options);
  return { data, error };
};

/** Satıcı (sizin) bilgileriniz; VKN sunucudaki QNB hesabından gelir, burada tutulmaz. */
export type SaticiBilgisi = Omit<Taraf, "vknTckn"> & {
  /** e-Fatura serisi (3 karakter, ör. ABC) */
  efaturaSeri: string;
  /** e-Arşiv serisi (3 karakter; boşsa QNB'deki varsayılan seri) */
  earsivSeri: string;
};

export const BOS_SATICI: SaticiBilgisi = {
  unvan: "",
  ad: "",
  soyad: "",
  vergiDairesi: "",
  adres: "",
  ilce: "",
  il: "",
  eposta: "",
  telefon: "",
  efaturaSeri: "",
  earsivSeri: "",
};

const KEY = "faturaKes:satici:v1";

/** Tarayıcıda saklanan satıcı bilgileri (yoksa ya da okunamazsa boş) */
export function saticiOku(): SaticiBilgisi {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...BOS_SATICI };
    const v = JSON.parse(raw) as Partial<SaticiBilgisi>;
    const out = { ...BOS_SATICI };
    for (const k of Object.keys(BOS_SATICI) as (keyof SaticiBilgisi)[]) {
      if (typeof v[k] === "string") out[k] = v[k] as string;
    }
    return out;
  } catch {
    return { ...BOS_SATICI };
  }
}

export function saticiYaz(s: SaticiBilgisi): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Gizli pencere vb.: bilgiler yalnızca bu oturumda kalır
  }
}

/** Seri: büyük harf, yalnızca harf/rakam, en çok 3 karakter */
export function seriTemizle(s: string): string {
  return s
    .toLocaleUpperCase("tr-TR")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
}

/** "1.234,5" / "1234.5" / "1234,50" → 1234.5 (geçersizse NaN) */
export function sayiOku(s: string): number {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^-?\d+(\.\d+)?$/.test(norm) ? Number(norm) : NaN;
}
