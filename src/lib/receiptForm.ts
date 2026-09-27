import { amountToInput, normalizeTrDate, parseAmount, todayTr } from './format';
import type { ReceiptData } from '../types/receipt';

/** Formda tutarlar metin olarak tutulur ki kullanıcı "12,5" gibi ara değerler yazabilsin. */
export interface ReceiptFormValues {
  firmaAdi: string;
  tarih: string;
  toplamTutar: string;
  kdvYuzde1: string;
  kdvYuzde10: string;
  kdvYuzde20: string;
  kategori: ReceiptData['kategori'];
}

export function toFormValues(d: ReceiptData): ReceiptFormValues {
  return {
    firmaAdi: d.firmaAdi,
    tarih: d.tarih,
    toplamTutar: amountToInput(d.toplamTutar),
    kdvYuzde1: amountToInput(d.kdvYuzde1),
    kdvYuzde10: amountToInput(d.kdvYuzde10),
    kdvYuzde20: amountToInput(d.kdvYuzde20),
    kategori: d.kategori,
  };
}

/** Boş form (tarih her çağrıda bugünün tarihi) */
export const emptyForm = (): ReceiptFormValues => ({
  firmaAdi: '',
  tarih: todayTr(),
  toplamTutar: '',
  kdvYuzde1: '0,00',
  kdvYuzde10: '0,00',
  kdvYuzde20: '0,00',
  kategori: 'ofis gideri',
});

export function fromFormValues(v: ReceiptFormValues): ReceiptData {
  return {
    firmaAdi: v.firmaAdi.trim(),
    tarih: normalizeTrDate(v.tarih) ?? v.tarih.trim(),
    toplamTutar: parseAmount(v.toplamTutar),
    kdvYuzde1: parseAmount(v.kdvYuzde1),
    kdvYuzde10: parseAmount(v.kdvYuzde10),
    kdvYuzde20: parseAmount(v.kdvYuzde20),
    kategori: v.kategori,
  };
}

/** Kaydetmeden önce kontrol; hata yoksa boş dizi döner. */
export function validateForm(v: ReceiptFormValues): string[] {
  const d = fromFormValues(v);
  const errors: string[] = [];
  if (!d.firmaAdi) errors.push('Firma adı boş olamaz.');
  if (!normalizeTrDate(v.tarih)) errors.push('Tarih GG.AA.YYYY biçiminde olmalı.');
  if (d.toplamTutar <= 0) errors.push('Toplam tutar 0’dan büyük olmalı.');
  if (d.kdvYuzde1 + d.kdvYuzde10 + d.kdvYuzde20 > d.toplamTutar) {
    errors.push('Toplam KDV, toplam tutardan büyük olamaz. TOPLAM ile TOPKDV karışmış olabilir.');
  }
  return errors;
}
