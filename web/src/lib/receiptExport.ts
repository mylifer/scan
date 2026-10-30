import { summarizeReceipts } from "@shared/lib/summary";
import { buildAccountingPackageWith } from "@shared/services/export/accountingPackage";
import { buildReceiptsWorkbook } from "@shared/services/export/receiptsWorkbook";
import type { ReceiptRecord } from "@shared/types/receipt";
import { downloadFile, XLSX_MIME } from "@/lib/download";
import { downloadBytes } from "@/lib/receipts";

/** iOS'taki exportFilename ile aynı adlar: "Fisler_2026-09.xlsx", "Muhasebe_Paketi_2026-09.zip" (tag boş: tüm zamanlar) */
export function exportName(tag: string | undefined, ext: "xlsx" | "zip") {
  const base = tag ? `Fisler_${tag}` : "Fisler_Tum_Zamanlar";
  return ext === "zip" ? `${base.replace("Fisler", "Muhasebe_Paketi")}.zip` : `${base}.xlsx`;
}

export function exportExcel(rows: ReceiptRecord[], periodLabel: string, tag: string | undefined) {
  const bytes = buildReceiptsWorkbook(summarizeReceipts(rows), periodLabel);
  downloadFile([bytes as BlobPart], exportName(tag, "xlsx"), XLSX_MIME);
}

/** Excel + fotoğraflar tek ZIP (muhasebe paketi). */
export async function exportPackage(
  rows: ReceiptRecord[],
  periodLabel: string,
  tag: string | undefined,
  onProgress?: (done: number, total: number) => void,
) {
  const parts: Uint8Array[] = [];
  const result = await buildAccountingPackageWith(
    downloadBytes,
    summarizeReceipts(rows),
    periodLabel,
    exportName(tag, "xlsx"),
    (c) => parts.push(c),
    onProgress,
  );
  downloadFile(parts as BlobPart[], exportName(tag, "zip"), "application/zip");
  return result;
}
