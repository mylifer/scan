import { amountToInput, normalizeTrDate, parseAmount, todayTr, trDateToIso } from './format';
import { KATEGORI_ETIKETLERI, type Kategori, type ReceiptData, type ReceiptField } from '../types/receipt';

/** Formda tutarlar metin olarak tutulur ki kullanıcı "12,5" gibi ara değerler yazabilsin. */
export interface ReceiptFormValues {
  firmaAdi: string;
  tarih: string;
  toplamTutar: string;
  kdvYuzde1: string;
  kdvYuzde10: string;
  kdvYuzde20: string;
  kategori: ReceiptData['kategori'];
  /** Yapay zekânın emin olamadığı alanlar; kullanıcı alanı değiştirince listeden çıkar */
  belirsiz?: ReceiptField[];
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
    ...(d.eminOlunmayanlar?.length ? { belirsiz: [...d.eminOlunmayanlar] } : {}),
  };
}

/** Bir alan düzenlenince o alanın "emin değilim" işaretini kaldırır */
export function setFormField<K extends keyof ReceiptFormValues>(v: ReceiptFormValues, key: K, value: ReceiptFormValues[K]): ReceiptFormValues {
  const next = { ...v, [key]: value };
  if (v.belirsiz?.includes(key as ReceiptField)) {
    const rest = v.belirsiz.filter((f) => f !== key);
    if (rest.length) next.belirsiz = rest;
    else delete next.belirsiz;
  }
  return next;
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

/** En yüksek KDV oranı %20 → KDV, KDV dahil toplamın en fazla 20/120'si (%16,67) olabilir. */
const MAX_KDV_SHARE = 20 / 120;

/**
 * Kaydı engellemeyen ama dikkat edilmesi gereken durumlar (formun altında gösterilir).
 * Hatalar için validateForm'a bakın.
 */
export function formWarnings(v: ReceiptFormValues, today = new Date()): string[] {
  const warnings: string[] = [];
  const iso = trDateToIso(v.tarih);
  if (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date > start) warnings.push('Fiş tarihi ileri bir tarih. Tarihi kontrol edin.');
    const yearAgo = new Date(start);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    if (date < yearAgo) warnings.push('Fiş bir yıldan eski. Tarih doğru mu?');
  }
  const total = parseAmount(v.toplamTutar);
  const kdv = parseAmount(v.kdvYuzde1) + parseAmount(v.kdvYuzde10) + parseAmount(v.kdvYuzde20);
  if (total > 0 && kdv <= total && kdv > total * MAX_KDV_SHARE + 0.05) {
    warnings.push('KDV, toplamın %16,7’sinden fazla görünüyor (en yüksek oran %20). Matrah ile KDV karışmış olabilir.');
  }
  if (total > 0 && kdv === 0) warnings.push('Hiç KDV girilmedi. POS fişlerinde genellikle KDV bulunur.');
  const unusual = unusualRates(v.kategori, { 1: parseAmount(v.kdvYuzde1), 10: parseAmount(v.kdvYuzde10), 20: parseAmount(v.kdvYuzde20) });
  if (unusual.length) {
    const list = unusual.map((r) => `%${r}`).join(' ve ');
    warnings.push(`${KATEGORI_ETIKETLERI[v.kategori]} fişlerinde ${list} KDV pek görülmez. Tutarın doğru dilime yazıldığını ve kategoriyi kontrol edin.`);
  }
  return warnings;
}

type Rate = 1 | 10 | 20;

/**
 * Kategoride pek görülmeyen KDV dilimleri (yalnızca emin olunan durumlar; uyarıdır, kaydı engellemez):
 * akaryakıt, araç bakım ve iletişim %20; restoran, konaklama ve giyimde %1 beklenmez
 * (yemek/konaklama/giyim %10, alkol ve bazı ürünler %20). Market gibi karışık kategoriler kontrol edilmez.
 */
const UNUSUAL_RATES: Partial<Record<Kategori, Rate[]>> = {
  akaryakıt: [1, 10],
  'araç bakım': [1, 10],
  iletişim: [1, 10],
  restoran: [1],
  konaklama: [1],
  giyim: [1],
  teknoloji: [1],
};

export function unusualRates(kategori: Kategori, amounts: Record<Rate, number>): Rate[] {
  return (UNUSUAL_RATES[kategori] ?? []).filter((r) => amounts[r] > 0);
}
