import { monthRange } from "@shared/lib/format";
import { ZipStream } from "@shared/lib/zipStream";
import { buildEFaturaWorkbook } from "@shared/services/efatura/efaturaWorkbook";
import { fetchInvoicePdf, type CachedPdf } from "@shared/services/efatura/pdfCache";
import {
  getEFaturaDetay,
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

  const result = await listEFaturalar(webInvoker, yon, baslangic, bitis);
  donemCache.set(key, result);
  return result;
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
