import type { Kategori, ReceiptData, ReceiptRecord } from '../../types/receipt';

/*
 * receipts tablosu satır dönüşümleri: platformdan bağımsız saf TS
 * (iOS deposu ve web uygulaması ortak kullanır).
 */

/** Fiş no, VKN, not ve etiket sütunları (006 kurulumu); boş değerler null/[] olarak yazılır */
export function extraColumns(data: Pick<ReceiptData, 'fisNo' | 'vkn' | 'notlar' | 'etiketler'>) {
  return {
    fis_no: data.fisNo?.trim() || null,
    vkn: data.vkn?.trim() || null,
    notlar: data.notlar?.trim() || null,
    etiketler: data.etiketler ?? [],
  };
}

/** Çok sayıda kimlik tek istekte gönderilirse adres çok uzar (URL sınırı); 100'erli gruplara bölünür */
export function chunks<T>(list: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Kayıttaki (DB) fişi forma uygun ReceiptData'ya çevirir. */
export function recordToData(r: ReceiptRecord): ReceiptData {
  const [y, m, d] = r.tarih.split('-');
  return {
    firmaAdi: r.firma_adi,
    tarih: `${d}.${m}.${y}`,
    toplamTutar: r.toplam_tutar,
    kdvYuzde1: r.kdv_yuzde1,
    kdvYuzde10: r.kdv_yuzde10,
    kdvYuzde20: r.kdv_yuzde20,
    kategori: r.kategori,
    ...(r.fis_no ? { fisNo: r.fis_no } : {}),
    ...(r.vkn ? { vkn: r.vkn } : {}),
    ...(r.notlar ? { notlar: r.notlar } : {}),
    ...(r.etiketler.length ? { etiketler: [...r.etiketler] } : {}),
  };
}

// numeric kolonlar güvenlik için Number'a çevrilir
export function toRecord(row: Record<string, unknown>): ReceiptRecord {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    firma_adi: String(row.firma_adi ?? ''),
    tarih: String(row.tarih),
    toplam_tutar: Number(row.toplam_tutar ?? 0),
    kdv_yuzde1: Number(row.kdv_yuzde1 ?? 0),
    kdv_yuzde10: Number(row.kdv_yuzde10 ?? 0),
    kdv_yuzde20: Number(row.kdv_yuzde20 ?? 0),
    toplam_kdv: Number(row.toplam_kdv ?? 0),
    kategori: row.kategori as Kategori,
    image_path: (row.image_path as string | null) ?? null,
    fis_no: typeof row.fis_no === 'string' && row.fis_no ? row.fis_no : null,
    vkn: typeof row.vkn === 'string' && row.vkn ? row.vkn : null,
    notlar: typeof row.notlar === 'string' && row.notlar ? row.notlar : null,
    etiketler: Array.isArray(row.etiketler) ? row.etiketler.filter((t): t is string => typeof t === 'string') : [],
    muhasebe_gonderildi_at: typeof row.muhasebe_gonderildi_at === 'string' && row.muhasebe_gonderildi_at ? row.muhasebe_gonderildi_at : null,
  };
}
