import { kalemSatirlari, satirdanKalem } from '../../../supabase/functions/_shared/kalemler';
import type { FisKalemi, Kategori, ReceiptData, ReceiptRecord } from '../../types/receipt';

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

/** Kalem tablosu (009 kurulumu) */
export const ITEMS_TABLE = 'receipt_items';

/** Yalnızca kullanılan Supabase metodları; mobil ve web farklı supabase-js kopyası kullandığından gevşek tip */
type Hata = { code?: string; message: string } | null;
interface KalemSorgusu {
  from(table: string): {
    insert(rows: Record<string, unknown>[]): PromiseLike<{ error: Hata }>;
    update(values: Record<string, unknown>): { eq(column: string, value: string): PromiseLike<{ error: Hata }> };
    delete(): { eq(column: string, value: string): PromiseLike<{ error: Hata }> };
    select(columns: string): {
      eq(column: string, value: string): { order(column: string): PromiseLike<{ data: Record<string, unknown>[] | null; error: Hata }> };
    };
  };
}
/** Supabase istemcisi (derin tip karşılaştırması yapılmasın diye yalnızca `from` aranır) */
export interface KalemIstemcisi {
  from(table: string): unknown;
}
const sorgu = (c: KalemIstemcisi) => c as unknown as KalemSorgusu;

/**
 * Taramada okunan kalemleri yeni fişe yazar ve fişin kalem durumunu işaretler. Hiçbir zaman hata fırlatmaz:
 * kurulum (009) yoksa ya da yazılamazsa fiş kalemsiz kalır ve fotoğrafı varsa geriye dönük okumaya girer.
 * kalemler undefined ise (elle giriş) hiçbir şey yapılmaz.
 */
export async function kalemleriKaydet(client: KalemIstemcisi, receiptId: string, kalemler: FisKalemi[] | undefined): Promise<boolean> {
  if (!kalemler) return false;
  try {
    const db = sorgu(client);
    if (kalemler.length) {
      const { error } = await db.from(ITEMS_TABLE).insert(kalemSatirlari(receiptId, kalemler, 'tarama'));
      if (error) return false;
    }
    const { error } = await db.from('receipts').update({ kalem_durumu: kalemler.length ? 'okundu' : 'yok' }).eq('id', receiptId);
    return !error;
  } catch {
    return false;
  }
}

/** Fişin kalemleri (sırasıyla); kurulum yoksa ya da okunamazsa boş dizi */
export async function fisKalemleriniGetir(client: KalemIstemcisi, receiptId: string): Promise<FisKalemi[]> {
  try {
    const { data, error } = await sorgu(client).from(ITEMS_TABLE).select('*').eq('receipt_id', receiptId).order('sira');
    return error || !data ? [] : data.map(satirdanKalem);
  } catch {
    return [];
  }
}

/** Fotoğrafı değişen fişin kalemleri silinir ve yeniden okunmak üzere sıraya alınır */
export async function kalemleriSifirla(client: KalemIstemcisi, receiptId: string): Promise<void> {
  try {
    const db = sorgu(client);
    await db.from(ITEMS_TABLE).delete().eq('receipt_id', receiptId);
    await db.from('receipts').update({ kalem_durumu: null, kalem_deneme: 0, kalem_model: null }).eq('id', receiptId);
  } catch {
    // Kurulum yoksa önemi yok
  }
}
