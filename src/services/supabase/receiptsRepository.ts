import { errorMessage } from '../../lib/errors';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { receiptImageName, round2, trDateToIso } from '../../lib/format';
import { buildMonthlySeries, type MonthPoint } from '../../lib/trend';
import type { Kategori, ReceiptData, ReceiptRecord } from '../../types/receipt';
import { supabase } from './client';

const TABLE = 'receipts';
export const RECEIPT_IMAGES_BUCKET = 'receipt-images';

export interface SaveResult {
  record: ReceiptRecord;
  /** Görsel yüklenemediyse fiş yine kaydedilir; bu alan uyarı içerir. */
  imageWarning?: string;
}

export async function saveReceipt(data: ReceiptData, archiveUri?: string): Promise<SaveResult> {
  const tarih = trDateToIso(data.tarih);
  if (!tarih) throw new Error('Tarih DD.MM.YYYY formatında olmalı.');

  const userId = await currentUserId();

  let imagePath: string | null = null;
  let imageWarning: string | undefined;
  if (archiveUri) {
    try {
      imagePath = await uploadImage(`${userId}/${receiptImageName(tarih, data.firmaAdi)}.jpg`, archiveUri);
    } catch (e) {
      imageWarning = `Fiş görseli yüklenemedi: ${errorMessage(e)}`;
    }
  }

  const { data: record, error } = await supabase
    .from(TABLE)
    .insert({
      firma_adi: data.firmaAdi.trim(),
      tarih,
      toplam_tutar: round2(data.toplamTutar),
      kdv_yuzde1: round2(data.kdvYuzde1),
      kdv_yuzde10: round2(data.kdvYuzde10),
      kdv_yuzde20: round2(data.kdvYuzde20),
      kategori: data.kategori,
      image_path: imagePath,
    })
    .select()
    .single();

  if (error) {
    if (imagePath) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([imagePath]);
    throw new Error(`Kayıt başarısız: ${error.message}`);
  }
  return { record: toRecord(record), imageWarning };
}

export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın.');
  return data.user.id;
}

export function uniqueName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Yerel görseli (web: blob URL, native: dosya URI) Storage'a yükler ve yolunu döner. */
export async function uploadImage(path: string, uri: string): Promise<string> {
  const bytes =
    Platform.OS === 'web' ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  const { error } = await supabase.storage
    .from(RECEIPT_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function getReceiptImageUrl(path: string, expiresInSec = 300): Promise<string | null> {
  const { data } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

export interface PeriodSummary {
  toplamGider: number;
  toplamKdv: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  fisSayisi: number;
  kategoriToplamlari: { kategori: Kategori; toplam: number }[];
  /** Dönemdeki tüm fişler; fiş tarihine, sonra eklenme zamanına göre yeniden eskiye */
  fisler: ReceiptRecord[];
}

/** Supabase tek istekte en fazla 1000 satır döndürür; daha fazlası sayfalanarak alınır. */
const PAGE_SIZE = 1000;

/**
 * Seçilen dönemi özetler. `range` verilmezse tüm zamanlar.
 * range: [from, to) aralığı, YYYY-MM-DD
 */
export async function getSummary(range?: { from: string; to: string }): Promise<PeriodSummary> {
  const rows: ReceiptRecord[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(TABLE).select('*');
    if (range) query = query.gte('tarih', range.from).lt('tarih', range.to);
    const { data, error } = await query
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []).map(toRecord));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const byKategori = new Map<Kategori, number>();
  let toplamGider = 0;
  let kdv1 = 0;
  let kdv10 = 0;
  let kdv20 = 0;
  for (const r of rows) {
    toplamGider += r.toplam_tutar;
    kdv1 += r.kdv_yuzde1;
    kdv10 += r.kdv_yuzde10;
    kdv20 += r.kdv_yuzde20;
    byKategori.set(r.kategori, (byKategori.get(r.kategori) ?? 0) + r.toplam_tutar);
  }

  return {
    toplamGider: round2(toplamGider),
    toplamKdv: round2(kdv1 + kdv10 + kdv20),
    kdv1: round2(kdv1),
    kdv10: round2(kdv10),
    kdv20: round2(kdv20),
    fisSayisi: rows.length,
    kategoriToplamlari: [...byKategori.entries()]
      .map(([kategori, toplam]) => ({ kategori, toplam: round2(toplam) }))
      .sort((a, b) => b.toplam - a.toplam),
    fisler: rows,
  };
}

/** Son `months` ayın aylık toplamları (grafik için; yalnızca gereken sütunlar indirilir). */
export async function getMonthlyTotals(months = 12): Promise<MonthPoint[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
  const rows: { tarih: string; toplam_tutar: number; toplam_kdv: number }[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('tarih,toplam_tutar,toplam_kdv')
      .gte('tarih', from)
      .order('tarih')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) rows.push({ tarih: String(r.tarih), toplam_tutar: Number(r.toplam_tutar), toplam_kdv: Number(r.toplam_kdv) });
    if (!data || data.length < PAGE_SIZE) break;
  }
  return buildMonthlySeries(rows, months, now);
}

/** Aynı tarih ve tutarda kayıtlı fişler (mükerrer kayıt uyarısı için). */
export async function findPossibleDuplicates(data: ReceiptData, excludeId?: string): Promise<ReceiptRecord[]> {
  const tarih = trDateToIso(data.tarih);
  if (!tarih) return [];
  let query = supabase.from(TABLE).select('*').eq('tarih', tarih).eq('toplam_tutar', round2(data.toplamTutar)).limit(3);
  if (excludeId) query = query.neq('id', excludeId);
  const { data: rows, error } = await query;
  if (error) return []; // kontrol başarısızsa kaydı engelleme
  return (rows ?? []).map(toRecord);
}

/** Tüm zamanlardaki fiş sayısı (satırları indirmeden). */
export async function countReceipts(): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface StorageUsage {
  bytes: number;
  files: number;
}

/** Kullanıcının Storage klasöründeki (arşiv + taslak) fotoğrafların toplam boyutu. */
export async function getStorageUsage(): Promise<StorageUsage> {
  const userId = await currentUserId();
  const usage: StorageUsage = { bytes: 0, files: 0 };
  for (const folder of [userId, `${userId}/drafts`]) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).list(folder, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      for (const f of data ?? []) {
        if (!f.id) continue; // alt klasör
        usage.files++;
        usage.bytes += Number(f.metadata?.size ?? 0);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return usage;
}

export async function getReceipt(id: string): Promise<ReceiptRecord> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return toRecord(data);
}

/** Kaydedilmiş fişin bilgilerini günceller (görsel değişmez). */
export async function updateReceipt(id: string, data: ReceiptData): Promise<ReceiptRecord> {
  const tarih = trDateToIso(data.tarih);
  if (!tarih) throw new Error('Tarih GG.AA.YYYY biçiminde olmalı.');
  const { data: row, error } = await supabase
    .from(TABLE)
    .update({
      firma_adi: data.firmaAdi.trim(),
      tarih,
      toplam_tutar: round2(data.toplamTutar),
      kdv_yuzde1: round2(data.kdvYuzde1),
      kdv_yuzde10: round2(data.kdvYuzde10),
      kdv_yuzde20: round2(data.kdvYuzde20),
      kategori: data.kategori,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Güncellenemedi: ${error.message}`);
  return toRecord(row);
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
  };
}

/** Fişi ve (varsa) Storage'daki görselini siler. */
export async function deleteReceipt(receipt: ReceiptRecord): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', receipt.id);
  if (error) throw new Error(`Silinemedi: ${error.message}`);
  if (receipt.image_path) {
    // Görsel silinemese bile kayıt silinmiştir; yalnızca yer kaplar
    await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([receipt.image_path]);
  }
}

// numeric kolonlar güvenlik için Number'a çevrilir
function toRecord(row: Record<string, unknown>): ReceiptRecord {
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
  };
}
