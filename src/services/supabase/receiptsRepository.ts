import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { round2, trDateToIso } from '../../lib/format';
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

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın.');
  const userId = userData.user.id;

  let imagePath: string | null = null;
  let imageWarning: string | undefined;
  if (archiveUri) {
    try {
      imagePath = await uploadReceiptImage(userId, archiveUri);
    } catch (e) {
      imageWarning = `Fiş görseli yüklenemedi: ${(e as Error).message}`;
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

async function uploadReceiptImage(userId: string, uri: string): Promise<string> {
  const bytes =
    Platform.OS === 'web' ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
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

export interface MonthlySummary {
  toplamGider: number;
  toplamKdv: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  fisSayisi: number;
  kategoriToplamlari: { kategori: Kategori; toplam: number }[];
}

/** Fiş tarihinden bağımsız olarak en son eklenen fişler. */
export async function getRecentReceipts(limit = 5): Promise<ReceiptRecord[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRecord);
}

/** [from, to) aralığındaki (YYYY-MM-DD) fişleri özetler. */
export async function getSummary(from: string, to: string): Promise<MonthlySummary> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('tarih', from)
    .lt('tarih', to)
    .order('tarih', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map(toRecord);
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
  };
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
