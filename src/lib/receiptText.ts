import { categoryLabel } from './categories';
import type { ReceiptRecord } from '../types/receipt';
import { formatTL, isoToTrDate } from './format';

/** Tek bir fişi mesajla paylaşmak için düz metin (WhatsApp, e-posta). */
export function receiptShareText(
  r: Pick<ReceiptRecord, 'firma_adi' | 'tarih' | 'kategori' | 'toplam_tutar' | 'kdv_yuzde1' | 'kdv_yuzde10' | 'kdv_yuzde20'> &
    Partial<Pick<ReceiptRecord, 'fis_no' | 'vkn' | 'notlar' | 'etiketler'>>,
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
    `${isoToTrDate(r.tarih)} · ${categoryLabel(r.kategori)}`,
    `Toplam: ${formatTL(r.toplam_tutar)}`,
    `KDV: ${formatTL(kdv)}${slices.length ? ` (${slices.join(' · ')})` : ''}`,
    ...(r.fis_no ? [`Fiş No: ${r.fis_no}`] : []),
    ...(r.vkn ? [`${r.vkn.length === 11 ? 'TCKN' : 'VKN'}: ${r.vkn}`] : []),
    ...(r.etiketler?.length ? [`Etiketler: ${r.etiketler.join(', ')}`] : []),
    ...(r.notlar ? [`Not: ${r.notlar}`] : []),
  ].join('\n');
}
