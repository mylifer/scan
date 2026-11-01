import { monthRange } from "@shared/lib/format";
import { ZipStream } from "@shared/lib/zipStream";
import { buildEFaturaWorkbook } from "@shared/services/efatura/efaturaWorkbook";
import { fetchInvoicePdf, type CachedPdf } from "@shared/services/efatura/pdfCache";
import {
  getEFaturaDetay,
  getIlkAy,
  listEFaturalar,
  type EFatura,
  type FaturaDetay,
  type InvokeFn,
  type Kontrol,
  type TutarSatiri,
  type Tur,
  type Yon,
} from "@shared/services/efatura/qnbEfatura";
import { downloadFile, XLSX_MIME } from "@/lib/download";
import { supabase } from "@/lib/supabase";

export type { EFatura, FaturaDetay, Kontrol, TutarSatiri, Tur, Yon };

export const webInvoker: InvokeFn = async (name, options) => {
  const { data, error } = await supabase.functions.invoke(name, options);
  return {
    data: data as {
      faturalar?: EFatura[];
      uyari?: string;
      bilgi?: string;
      kontrol?: Kontrol;
      detay?: FaturaDetay;
      pdf?: string;
      ilkAy?: string | null;
      gelen?: TutarSatiri[];
      giden?: TutarSatiri[];
      earsiv?: EFatura[];
      qnb?: number | null;
      taslak?: number;
    } | null,
    error,
  };
};

export interface EFaturaDonemData {
  faturalar: EFatura[];
  uyari?: string;
  bilgi?: string;
  kontrol?: Kontrol;
}

const donemCache = new Map<string, EFaturaDonemData>();

export function getMonthBounds(offset: number) {
  const r = monthRange(offset);
  const [y, m] = r.from.split("-").map(Number);
  const last = new Date(y!, m!, 0).getDate();
  const bitis = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return {
    baslangic: r.from,
    bitis,
    label: r.label,
    fileTag: r.from.slice(0, 7),
  };
}

export function donemCacheKey(yon: Yon, baslangic: string) {
  return `${yon}:${baslangic}`;
}

export async function fetchDonemFaturalar(
  yon: Yon,
  offset: number,
  force = false,
): Promise<EFaturaDonemData> {
  const { baslangic, bitis } = getMonthBounds(offset);
  const key = donemCacheKey(yon, baslangic);

  if (!force && donemCache.has(key)) {
    return donemCache.get(key)!;
  }
  // Aynı dönem için süren istek paylaşılır (KDV ve e-Faturalar aynı anda isteyebilir)
  const running = donemInflight.get(key);
  if (running) return running;

  const p = listEFaturalar(webInvoker, yon, baslangic, bitis)
    .then((result) => {
      donemCache.set(key, result);
      persistDonem(key, result);
      return result;
    })
    .finally(() => donemInflight.delete(key));
  donemInflight.set(key, p);
  return p;
}

const donemInflight = new Map<string, Promise<EFaturaDonemData>>();

/*
 * Kalıcı önbellek (tarayıcı): QNB yavaş olduğu için her ayın son sonucu saklanır; sayfalar açılışta
 * önce bunu gösterir, güncel veri arka planda fetchDonemFaturalar ile gelir.
 */
const PERSIST_PREFIX = "efatura-donem:v1:";

export interface PersistedDonem {
  data: EFaturaDonemData;
  /** Kaydedildiği an (ms) */
  at: number;
}

function persistDonem(key: string, data: EFaturaDonemData) {
  try {
    localStorage.setItem(PERSIST_PREFIX + key, JSON.stringify({ data, at: Date.now() } satisfies PersistedDonem));
  } catch {
    // depolama kapalı ya da dolu: önbelleksiz devam
  }
}

/** Dönemin tarayıcıda saklanan son sonucu (bellekte varsa o). Yoksa null. */
export function readPersistedDonem(yon: Yon, offset: number): PersistedDonem | null {
  const key = donemCacheKey(yon, getMonthBounds(offset).baslangic);
  const mem = donemCache.get(key);
  if (mem) return { data: mem, at: Date.now() };
  try {
    const raw = localStorage.getItem(PERSIST_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw) as PersistedDonem;
    return Array.isArray(v?.data?.faturalar) ? v : null;
  } catch {
    return null;
  }
}

async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

/** İlk fatura ayı; yalnızca başarılı yanıt önbelleğe alınır (hata olursa sonraki çağrıda tekrar denenir). */
let cachedIlkAy: string | null | undefined = undefined;

export async function fetchIlkAy(): Promise<{ ilkAy: string | null; hata: boolean }> {
  if (cachedIlkAy !== undefined) return { ilkAy: cachedIlkAy, hata: false };
  try {
    cachedIlkAy = (await getIlkAy(webInvoker)) ?? null;
    return { ilkAy: cachedIlkAy, hata: false };
  } catch {
    return { ilkAy: null, hata: true };
  }
}

/** "Tümünü Göster" en fazla bu kadar ay geriye gider (QNB kotası) */
export const TUMU_MAX_AY = 36;
/** İlk fatura ayı bilinmiyorsa geriye dönük çekilen ay sayısı */
export const TUMU_VARSAYILAN_AY = 12;

/**
 * "Tümünü Göster" için çekilecek ay aralığı (offset: 0 = bu ay, -1 = geçen ay).
 * İlk fatura ayı biliniyorsa oradan başlar, en fazla TUMU_MAX_AY ay; bilinmiyorsa TUMU_VARSAYILAN_AY ay.
 */
export function tumuAyAraligi(
  ilkAy: string | null,
  maxOffset: number,
  now: Date = new Date(),
): { offsets: number[]; kirpildi: boolean; ilkAyBilinmiyor: boolean } {
  let earliest = maxOffset - (TUMU_VARSAYILAN_AY - 1);
  let kirpildi = false;
  let ilkAyBilinmiyor = true;
  const [y, m] = (ilkAy ?? "").split("-").map(Number);
  if (y && m) {
    ilkAyBilinmiyor = false;
    const ilkOffset = (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
    const sinir = maxOffset - (TUMU_MAX_AY - 1);
    kirpildi = ilkOffset < sinir;
    earliest = Math.max(ilkOffset, sinir);
  }
  if (earliest > maxOffset) earliest = maxOffset;
  const offsets: number[] = [];
  for (let o = earliest; o <= maxOffset; o++) offsets.push(o);
  return { offsets, kirpildi, ilkAyBilinmiyor };
}

export type AySonucu =
  | { label: string; ok: true; data: EFaturaDonemData }
  | { label: string; ok: false; error: unknown };

/**
 * Aylık sonuçları birleştirir: ETTN'ye göre tekilleştirir, QNB sayılarını toplar, aylardan gelen uyarıları
 * korur ve yüklenemeyen ayları uyarı olarak bildirir. Hiçbir ay yüklenemediyse ilk hatayı fırlatır.
 */
export function aySonuclariniBirlestir(sonuclar: AySonucu[]): { data: EFaturaDonemData; eksikAy: number } {
  const basarisiz = sonuclar.filter((s): s is Extract<AySonucu, { ok: false }> => !s.ok);
  if (sonuclar.length > 0 && basarisiz.length === sonuclar.length) {
    const ilk = basarisiz[0]!.error;
    throw ilk instanceof Error ? ilk : new Error("Faturalar yüklenemedi.");
  }

  const seen = new Set<string>();
  const faturalar: EFatura[] = [];
  const uyarilar = new Set<string>();
  const bilgiler = new Set<string>();
  let totalListe = 0;
  let totalQnb = 0;
  let hasQnbCount = false;

  for (const s of sonuclar) {
    if (!s.ok) continue;
    const res = s.data;
    if (res.uyari) uyarilar.add(res.uyari);
    if (res.bilgi) bilgiler.add(res.bilgi);
    if (res.kontrol?.qnb !== null && res.kontrol?.qnb !== undefined) {
      totalQnb += res.kontrol.qnb;
      hasQnbCount = true;
    }
    totalListe += res.kontrol?.liste ?? res.faturalar.length;
    for (const f of res.faturalar) {
      const key = (f.ettn || `${f.belgeNo}:${f.tarih}`).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        faturalar.push(f);
      }
    }
  }

  if (basarisiz.length > 0) {
    const aylar = basarisiz.map((s) => s.label).join(", ");
    uyarilar.add(
      `${basarisiz.length} ay yüklenemedi (${aylar}). Toplamlar eksik olabilir; "Yenile" ile tekrar deneyin.`,
    );
  }

  faturalar.sort((a, b) => (b.tarih || "").localeCompare(a.tarih || ""));

  return {
    data: {
      faturalar,
      kontrol: { liste: totalListe, qnb: hasQnbCount ? totalQnb : null },
      ...(uyarilar.size ? { uyari: [...uyarilar].join(" ") } : {}),
      ...(bilgiler.size ? { bilgi: [...bilgiler].join(" ") } : {}),
    },
    eksikAy: basarisiz.length,
  };
}

const allFaturalarCache = new Map<string, EFaturaDonemData>();

/**
 * Belirli bir offset'e kadarki tüm faturaları aylar bazında (3'erli paralel) çeker ve birleştirir.
 * Eksik sonuç (yüklenemeyen ay ya da bilinmeyen ilk fatura ayı) önbelleğe alınmaz.
 */
export async function fetchAllFaturalar(
  yon: Yon,
  maxOffset = 0,
  force = false,
): Promise<EFaturaDonemData> {
  const cacheKey = `${yon}:all:${maxOffset}`;
  if (!force && allFaturalarCache.has(cacheKey)) {
    return allFaturalarCache.get(cacheKey)!;
  }

  const ilk = await fetchIlkAy();
  const { offsets, kirpildi, ilkAyBilinmiyor } = tumuAyAraligi(ilk.ilkAy, maxOffset);

  // Paralel (3'erli gruplar) çek; QNB kotasını korumak için limit 3
  const sonuclar = await mapConcurrent(offsets, 3, async (off): Promise<AySonucu> => {
    const label = getMonthBounds(off).label;
    try {
      return { label, ok: true, data: await fetchDonemFaturalar(yon, off, force) };
    } catch (error) {
      return { label, ok: false, error };
    }
  });

  const { data, eksikAy } = aySonuclariniBirlestir(sonuclar);

  const notlar: string[] = [];
  if (ilk.hata) {
    notlar.push(`İlk fatura ayı alınamadı; yalnızca son ${TUMU_VARSAYILAN_AY} ay gösteriliyor.`);
  } else if (ilkAyBilinmiyor) {
    notlar.push(`İlk fatura ayı bilinmiyor; son ${TUMU_VARSAYILAN_AY} ay gösteriliyor.`);
  } else if (kirpildi) {
    notlar.push(`Yalnızca son ${TUMU_MAX_AY} ay gösteriliyor; daha eski faturalar için aylık görünümü kullanın.`);
  }
  if (notlar.length) {
    data.bilgi = [...notlar, data.bilgi].filter(Boolean).join(" ");
  }

  if (eksikAy === 0 && !ilk.hata) {
    allFaturalarCache.set(cacheKey, data);
  }
  return data;
}

export async function fetchPdf(yon: Yon, ettn: string, tur: Tur = "efatura"): Promise<CachedPdf> {
  return await fetchInvoicePdf(yon, ettn, tur, webInvoker);
}

export async function fetchDetay(yon: Yon, ettn: string, tur: Tur = "efatura"): Promise<FaturaDetay> {
  return await getEFaturaDetay(webInvoker, yon, ettn, tur);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

/** Excel (.xlsx) dışa aktarımı */
export function exportExcel(faturalar: EFatura[], periodLabel: string, yon: Yon) {
  const bytes = buildEFaturaWorkbook(faturalar, periodLabel, yon);
  const yonTag = yon === "gelen" ? "Gelen" : "Giden";
  const cleanLabel = sanitizeFilename(periodLabel.replace(/\s+/g, "_"));
  const filename = `${yonTag}_EFaturalar_${cleanLabel}.xlsx`;
  downloadFile([bytes as BlobPart], filename, XLSX_MIME);
}

/** Birden fazla PDF ve özet Excel'i tek ZIP olarak dışa aktarımı */
export async function exportPdfsZip(
  faturalar: EFatura[],
  periodLabel: string,
  yon: Yon,
  onProgress?: (done: number, total: number) => void,
): Promise<{ success: number; failed: number }> {
  const withEttn = faturalar.filter((f) => Boolean(f.ettn));
  if (withEttn.length === 0) {
    throw new Error("Dışa aktarılacak faturanın ETTN bilgisi bulunamadı.");
  }

  // Tek fatura: doğrudan PDF indir
  if (withEttn.length === 1) {
    const f = withEttn[0]!;
    onProgress?.(0, 1);
    const cached = await fetchPdf(yon, f.ettn, f.tur);
    const safeDoc = sanitizeFilename(f.belgeNo || f.ettn);
    const safeTitle = sanitizeFilename(f.unvan).slice(0, 30);
    const filename = `${f.tarih}_${safeDoc}_${safeTitle}.pdf`;
    downloadFile([cached.bytes as BlobPart], filename, "application/pdf");
    onProgress?.(1, 1);
    return { success: 1, failed: 0 };
  }

  // Çoklu fatura: akışlı ZIP arşivi
  const yonTag = yon === "gelen" ? "Gelen" : "Giden";
  const cleanLabel = sanitizeFilename(periodLabel.replace(/\s+/g, "_"));
  const zipFilename = `${yonTag}_EFaturalar_${cleanLabel}.zip`;

  const chunks: Uint8Array[] = [];
  const zip = new ZipStream((c) => chunks.push(c));

  // 1. Özet Excel'i de arşive ekle
  try {
    const excelBytes = buildEFaturaWorkbook(faturalar, periodLabel, yon);
    zip.add(`${yonTag}_Faturalar_Listesi.xlsx`, excelBytes, true);
  } catch {
    // Excel eklenemese de devam et
  }

  // 2. PDF dosyalarını paralel çekip arşive ekle
  let success = 0;
  let failed = 0;
  let next = 0;
  let done = 0;
  const usedNames = new Set<string>();

  onProgress?.(0, withEttn.length);

  async function worker() {
    while (next < withEttn.length) {
      const f = withEttn[next++]!;
      const safeDoc = sanitizeFilename(f.belgeNo || f.ettn);
      const safeTitle = sanitizeFilename(f.unvan).slice(0, 30);
      let filename = `${f.tarih}_${safeDoc}_${safeTitle}.pdf`;

      let counter = 1;
      while (usedNames.has(filename)) {
        filename = `${f.tarih}_${safeDoc}_${safeTitle}_${counter++}.pdf`;
      }
      usedNames.add(filename);

      try {
        const cached = await fetchPdf(yon, f.ettn, f.tur);
        zip.add(filename, cached.bytes, false);
        success++;
      } catch {
        failed++;
      }
      onProgress?.(++done, withEttn.length);
    }
  }

  const concurrency = Math.min(4, withEttn.length);
  await Promise.all(Array.from({ length: concurrency }, worker));

  zip.end();
  downloadFile(chunks as BlobPart[], zipFilename, "application/zip");

  return { success, failed };
}

export type EFaturaSortColumn = "tarih" | "unvan" | "tip" | "kdv" | "tutar";
export type EFaturaSortDir = "asc" | "desc";
export type EFaturaSortState = { column: EFaturaSortColumn; dir: EFaturaSortDir };

const trCollator = new Intl.Collator("tr-TR", { sensitivity: "base" });

export function getFaturaTipLabel(f: EFatura): string {
  if (f.tur === "earsiv") return "e-Arşiv";
  if (f.tip) return f.tip;
  if (f.profil) return f.profil;
  return "e-Fatura";
}

export function sortEFaturaList(list: EFatura[], { column, dir }: EFaturaSortState): EFatura[] {
  const tie = (a: EFatura, b: EFatura) =>
    b.tarih.localeCompare(a.tarih) || b.belgeNo.localeCompare(a.belgeNo);

  const sign = dir === "asc" ? 1 : -1;

  return [...list].sort((a, b) => {
    let diff = 0;
    switch (column) {
      case "tarih":
        diff = a.tarih.localeCompare(b.tarih) || a.belgeNo.localeCompare(b.belgeNo);
        break;
      case "unvan":
        diff = trCollator.compare(a.unvan || "", b.unvan || "");
        break;
      case "tip":
        diff = trCollator.compare(getFaturaTipLabel(a), getFaturaTipLabel(b));
        break;
      case "kdv": {
        const ak = typeof a.kdv === "number" ? a.kdv : (dir === "asc" ? Infinity : -Infinity);
        const bk = typeof b.kdv === "number" ? b.kdv : (dir === "asc" ? Infinity : -Infinity);
        diff = ak - bk;
        break;
      }
      case "tutar":
        diff = a.tutar - b.tutar;
        break;
    }
    return diff * sign || tie(a, b);
  });
}
