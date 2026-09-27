import { KATEGORI_ETIKETLERI, type ReceiptRecord } from '../types/receipt';
import { formatTL, isoToTrDate } from './format';

/** Tek bir fişi mesajla paylaşmak için düz metin (WhatsApp, e-posta). */
export function receiptShareText(
  r: Pick<ReceiptRecord, 'firma_adi' | 'tarih' | 'kategori' | 'toplam_tutar' | 'kdv_yuzde1' | 'kdv_yuzde10' | 'kdv_yuzde20' | 'fis_no' | 'vergi_no' | 'notlar'>,
): string {
  const kdv = r.kdv_yuzde1 + r.kdv_yuzde10 + r.kdv_yuzde20;
  const slices = (
    [
      ['%1', r.kdv_yuzde1],
      ['%10', r.kdv_yuzde10],
      ['%20', r.kdv_yuzde20],
    ] as const
  )
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${formatTL(v)}`);
  return [
    r.firma_adi,
    `${isoToTrDate(r.tarih)} · ${KATEGORI_ETIKETLERI[r.kategori] ?? r.kategori}`,
    `Toplam: ${formatTL(r.toplam_tutar)}`,
    `KDV: ${formatTL(kdv)}${slices.length ? ` (${slices.join(' · ')})` : ''}`,
    ...(r.vergi_no ? [`Vergi No: ${r.vergi_no}`] : []),
    ...(r.fis_no ? [`Fiş No: ${r.fis_no}`] : []),
    ...(r.notlar ? [`Not: ${r.notlar}`] : []),
  ].join('\n');
}
