import { ZipStream } from '../../lib/zipStream';
import { sharePdf, shareXlsx, shareZipStream } from '../export/exportReceipts';
import { buildEFaturaWorkbook } from './efaturaWorkbook';
import { fetchInvoicePdf } from './pdfCache';
import type { EFatura, Yon } from './qnbEfatura';

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/**
 * Seçilen e-Faturaları Excel (.xlsx) dosyası olarak dışa aktarır.
 */
export async function exportEFaturaExcel(faturalar: EFatura[], periodLabel: string, yon: Yon): Promise<void> {
  const bytes = buildEFaturaWorkbook(faturalar, periodLabel, yon);
  const yonTag = yon === 'gelen' ? 'Gelen' : 'Giden';
  const cleanLabel = sanitizeFilename(periodLabel.replace(/\s+/g, '_'));
  const filename = `${yonTag}_EFaturalar_${cleanLabel}.xlsx`;
  await shareXlsx(bytes, filename);
}

export interface ExportPdfsResult {
  success: number;
  failed: number;
}

/**
 * Seçilen e-Faturaların PDF'lerini dışa aktarır.
 * 1 fatura ise doğrudan .pdf indirir.
 * Birden fazla ise tüm PDF'leri ve özet Excel tablosunu içeren bir .zip arşivi üretir.
 */
export async function exportEFaturaPdfs(
  faturalar: EFatura[],
  yon: Yon,
  periodLabel: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ExportPdfsResult> {
  const withEttn = faturalar.filter((f) => !!f.ettn);
  if (withEttn.length === 0) {
    throw new Error('Dışa aktarılacak faturanın ETTN bilgisi bulunamadı.');
  }

  // Tek fatura: doğrudan PDF paylaş / indir
  if (withEttn.length === 1) {
    const f = withEttn[0]!;
    onProgress?.(0, 1);
    const cached = await fetchInvoicePdf(yon, f.ettn, f.tur);
    const safeDoc = sanitizeFilename(f.belgeNo || f.ettn);
    const safeTitle = sanitizeFilename(f.unvan).slice(0, 30);
    const filename = `${f.tarih}_${safeDoc}_${safeTitle}.pdf`;
    await sharePdf(cached.bytes, filename);
    onProgress?.(1, 1);
    return { success: 1, failed: 0 };
  }

  // Birden çok fatura: akışlı ZIP arşivi
  const yonTag = yon === 'gelen' ? 'Gelen' : 'Giden';
  const cleanLabel = sanitizeFilename(periodLabel.replace(/\s+/g, '_'));
  const zipFilename = `${yonTag}_EFaturalar_${cleanLabel}.zip`;

  let success = 0;
  let failed = 0;
  let done = 0;

  await shareZipStream(zipFilename, async (sink) => {
    const zip = new ZipStream(sink);

    // 1. Özet Excel tablosunu da ZIP içine ekle
    try {
      const excelBytes = buildEFaturaWorkbook(faturalar, periodLabel, yon);
      zip.add(`${yonTag}_Faturalar_Listesi.xlsx`, excelBytes, true);
    } catch {
      // Excel eklenemese de PDF'ler devam etsin
    }

    // 2. PDF dosyalarını paralel çekip arşive ekle
    onProgress?.(0, withEttn.length);
    const usedNames = new Set<string>();

    for (const f of withEttn) {
      try {
        const cached = await fetchInvoicePdf(yon, f.ettn, f.tur);
        const safeDoc = sanitizeFilename(f.belgeNo || f.ettn);
        const safeTitle = sanitizeFilename(f.unvan).slice(0, 30);
        let name = `${f.tarih}_${safeDoc}_${safeTitle}.pdf`;

        // Aynı isimde birden fazla dosya oluşmasını engelle
        if (usedNames.has(name)) {
          name = `${f.tarih}_${safeDoc}_${f.ettn.slice(0, 8)}.pdf`;
        }
        usedNames.add(name);

        zip.add(name, cached.bytes, false);
        success++;
      } catch {
        failed++;
      } finally {
        done++;
        onProgress?.(done, withEttn.length);
      }
    }

    zip.end();
  });

  return { success, failed };
}
