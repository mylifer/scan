import { periodRange, type Period } from "@shared/lib/period";
import type { ReceiptRecord } from "@shared/types/receipt";

export type SortColumn = "tarih" | "firma_adi" | "kategori" | "toplam_tutar" | "toplam_kdv";
export type SortState = { column: SortColumn; dir: "asc" | "desc" };

const collator = new Intl.Collator("tr-TR", { sensitivity: "base" });

/** Tablo sütununa göre sıralar (yeni dizi); eşitlikte tarih → eklenme zamanı yeniden eskiye. */
export function sortRows(rows: ReceiptRecord[], { column, dir }: SortState): ReceiptRecord[] {
  const sign = dir === "asc" ? 1 : -1;
  const tie = (a: ReceiptRecord, b: ReceiptRecord) => b.tarih.localeCompare(a.tarih) || b.created_at.localeCompare(a.created_at);
  return [...rows].sort((a, b) => {
    let c: number;
    if (column === "toplam_tutar" || column === "toplam_kdv") c = a[column] - b[column];
    else if (column === "tarih") c = a.tarih.localeCompare(b.tarih) || a.created_at.localeCompare(b.created_at);
    else c = collator.compare(a[column], b[column]);
    return c * sign || tie(a, b);
  });
}

/** Dönem seçicisinin değerleri: "m0" (bu ay), "m-3", "y0", "y-1", "all" */
export function periodFromKey(key: string): Period {
  if (key === "all") return { mode: "all" };
  const offset = Number(key.slice(1)) || 0;
  return { mode: key[0] === "y" ? "year" : "month", offset };
}

export function periodOptions(now = new Date()): { key: string; label: string }[] {
  const months = Array.from({ length: 12 }, (_, i) => `m${-i}`.replace("m-0", "m0"));
  const years = Array.from({ length: 3 }, (_, i) => `y${-i}`.replace("y-0", "y0"));
  return [...months, ...years, "all"].map((key) => ({
    key,
    label: periodRange(periodFromKey(key), now)?.label ?? "Tüm zamanlar",
  }));
}
