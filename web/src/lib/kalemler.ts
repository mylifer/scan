import { fisKalemleriniGetir } from "@shared/services/supabase/receiptRows";
import type { FisKalemi } from "@shared/types/receipt";
import { supabase } from "./supabase";

/** Deneme için seçilebilen modeller (kalem-doldur fonksiyonundaki izinli liste ile aynı) */
export const KALEM_MODELLERI = [
  { id: "gemini-2.5-flash", ad: "Gemini 2.5 Flash", gunluk: 20 },
  { id: "gemini-3.6-flash", ad: "Gemini 3.6 Flash", gunluk: 20 },
  { id: "gemini-3.5-flash-lite", ad: "Gemini 3.5 Flash Lite", gunluk: 500 },
] as const;
export type KalemModeli = (typeof KALEM_MODELLERI)[number]["id"];

/** Fişlerin kalem okuma durumu; null: 009 kurulumu yapılmamış */
export interface KalemDurumlari {
  okundu: number;
  yok: number;
  okunamadi: number;
  /** Fotoğraflı, henüz okunmamış (geriye dönük okuma sırası) */
  bekleyen: number;
}

async function say(filtre: (q: ReturnType<typeof taban>) => ReturnType<typeof taban>): Promise<number> {
  const { count, error } = await filtre(taban());
  if (error) throw error;
  return count ?? 0;
}
const taban = () => supabase.from("receipts").select("id", { count: "exact", head: true });

export async function kalemDurumlari(): Promise<KalemDurumlari | null> {
  try {
    const [okundu, yok, okunamadi, bekleyen] = await Promise.all([
      say((q) => q.eq("kalem_durumu", "okundu")),
      say((q) => q.eq("kalem_durumu", "yok")),
      say((q) => q.eq("kalem_durumu", "okunamadi")),
      say((q) => q.not("image_path", "is", null).or("kalem_durumu.is.null,kalem_durumu.eq.isleniyor")),
    ]);
    return { okundu, yok, okunamadi, bekleyen };
  } catch (e) {
    // 42703: sütun yok → kurulum yapılmamış
    const code = (e as { code?: string })?.code;
    if (code === "42703" || code === "PGRST204") return null;
    throw new Error(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "Kalem durumu alınamadı.");
  }
}

export interface KalemDenemeSonucu {
  calisti: boolean;
  neden?: string;
  okundu: number;
  tutarli: number;
  bos: number;
  okunamadi: number;
  dolanModeller: string[];
  kalan: number | null;
  sonuclar: {
    id: string;
    firma: string;
    toplam: number;
    kalemAdedi: number;
    kalemToplami: number;
    tutarli: boolean;
    model: string;
  }[];
}

async function denemeCagrisi(model: KalemModeli, adet: number): Promise<KalemDenemeSonucu> {
  const { data, error } = await supabase.functions.invoke("kalem-doldur", { body: { deneme: true, model, adet } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detay = ctx ? await ctx.json().catch(() => null) : null;
    throw new Error(detay?.message ?? (error instanceof Error ? error.message : "Deneme çalıştırılamadı."));
  }
  return data as KalemDenemeSonucu;
}

/** Ardışık çağrıların sonuçlarını toplar */
export function denemeleriBirlestir(a: KalemDenemeSonucu, b: KalemDenemeSonucu): KalemDenemeSonucu {
  return {
    calisti: a.calisti || b.calisti,
    neden: b.neden ?? a.neden,
    okundu: a.okundu + b.okundu,
    tutarli: a.tutarli + b.tutarli,
    bos: a.bos + b.bos,
    okunamadi: a.okunamadi + b.okunamadi,
    dolanModeller: [...new Set([...a.dolanModeller, ...b.dolanModeller])],
    kalan: b.kalan,
    sonuclar: [...a.sonuclar, ...b.sonuclar],
  };
}

/**
 * Eski fişlerden `adet` tanesinin kalemlerini seçilen modelle hemen okutur (en fazla 20). Fonksiyonun bir çağrısı
 * ~110 sn sürebildiği ve Flash dakikada 5 istekle sınırlı olduğu için, istenen sayıya ulaşana, kota dolana ya da
 * bekleyen fiş bitene kadar art arda çağrılır.
 */
export async function kalemDenemesiYap(model: KalemModeli, adet: number, onIlerleme?: (s: KalemDenemeSonucu) => void): Promise<KalemDenemeSonucu> {
  let toplam: KalemDenemeSonucu | null = null;
  for (let tur = 0; tur < 6; tur++) {
    const islenen = toplam ? toplam.okundu + toplam.bos + toplam.okunamadi : 0;
    const kalan = adet - islenen;
    if (kalan <= 0) break;
    const r = await denemeCagrisi(model, kalan);
    toplam = toplam ? denemeleriBirlestir(toplam, r) : r;
    onIlerleme?.(toplam);
    const buTur = r.okundu + r.bos + r.okunamadi;
    if (!buTur || r.dolanModeller.length || r.kalan === 0) break;
  }
  return toplam!;
}

export function fisKalemleri(receiptId: string): Promise<FisKalemi[]> {
  return fisKalemleriniGetir(supabase, receiptId);
}
