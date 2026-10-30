import { receiptImageName, round2, trDateToIso } from "@shared/lib/format";
import { setCustomCategories } from "@shared/lib/categories";
import { chunks, extraColumns, toRecord } from "@shared/services/supabase/receiptRows";
import type { ReceiptData, ReceiptRecord } from "@shared/types/receipt";
import { supabase } from "@/lib/supabase";

/*
 * Web fiş deposu: iOS'taki receiptsRepository ile aynı tablo, sütun ve Storage kovası;
 * satır dönüşümleri ortak saf modülden (receiptRows) gelir.
 */

const TABLE = "receipts";
const TRASH_TABLE = "receipt_trash";
export const RECEIPT_IMAGES_BUCKET = "receipt-images";
const PAGE_SIZE = 1000;
const TRASH_SCHEMA_VERSION = 5;

export type DateRange = { from: string; to: string };

/** Dönemdeki tüm fişler (sayfalanarak), fiş tarihine göre yeniden eskiye. */
export async function listReceipts(range?: DateRange): Promise<ReceiptRecord[]> {
  const rows: ReceiptRecord[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(TABLE).select("*");
    if (range) query = query.gte("tarih", range.from).lt("tarih", range.to);
    const { data, error } = await query
      .order("tarih", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []).map(toRecord));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function getReceipt(id: string): Promise<ReceiptRecord> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return toRecord(data);
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Oturum bulunamadı, lütfen tekrar giriş yapın.");
  return data.user.id;
}

async function uploadImage(tarih: string, firma: string, file: Blob): Promise<string> {
  const path = `${await currentUserId()}/${receiptImageName(tarih, firma)}.jpg`;
  const { error } = await supabase.storage
    .from(RECEIPT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Fotoğraf yüklenemedi: ${error.message}`);
  return path;
}

function dataColumns(data: ReceiptData) {
  const tarih = trDateToIso(data.tarih);
  if (!tarih) throw new Error("Tarih GG.AA.YYYY biçiminde olmalı.");
  return {
    firma_adi: data.firmaAdi.trim(),
    tarih,
    toplam_tutar: round2(data.toplamTutar),
    kdv_yuzde1: round2(data.kdvYuzde1),
    kdv_yuzde10: round2(data.kdvYuzde10),
    kdv_yuzde20: round2(data.kdvYuzde20),
    kategori: data.kategori,
    ...extraColumns(data),
  };
}

/** Yeni fiş (isteğe bağlı fotoğrafla). */
export async function createReceipt(data: ReceiptData, photo?: File | null): Promise<ReceiptRecord> {
  const cols = dataColumns(data);
  const imagePath = photo ? await uploadImage(cols.tarih, cols.firma_adi, photo) : null;
  const { data: row, error } = await supabase.from(TABLE).insert({ ...cols, image_path: imagePath }).select().single();
  if (error) {
    if (imagePath) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([imagePath]);
    throw new Error(`Kayıt başarısız: ${error.message}`);
  }
  return toRecord(row);
}

/** Fiş bilgilerini günceller; fotoğraf verilirse eskisinin yerine geçer. */
export async function updateReceipt(record: ReceiptRecord, data: ReceiptData, photo?: File | null): Promise<ReceiptRecord> {
  const cols = dataColumns(data);
  const imagePath = photo ? await uploadImage(cols.tarih, cols.firma_adi, photo) : undefined;
  const { data: row, error } = await supabase
    .from(TABLE)
    .update(imagePath ? { ...cols, image_path: imagePath } : cols)
    .eq("id", record.id)
    .select()
    .single();
  if (error) {
    if (imagePath) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([imagePath]);
    throw new Error(`Güncellenemedi: ${error.message}`);
  }
  if (imagePath && record.image_path) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([record.image_path]);
  return toRecord(row);
}

let trashKnown: boolean | null = null;

/** Çöp kutusu (005) kurulu mu? Belirsizse null. */
async function trashReady(): Promise<boolean | null> {
  if (trashKnown) return true;
  const { data, error } = await supabase.rpc("receipt_schema_version");
  if (!error) return (trashKnown = (Number(data) || 0) >= TRASH_SCHEMA_VERSION);
  return error.code === "PGRST202" || /could not find the function/i.test(error.message) ? false : null;
}

/**
 * Fişi siler: çöp kutusu kuruluysa 30 gün geri alınabilir şekilde oraya taşır (fotoğraf saklanır),
 * değilse kalıcı siler. iOS'taki deleteReceipt ile aynı davranış.
 */
export async function deleteReceipt(id: string): Promise<"trash" | "deleted"> {
  const trash = await trashReady();
  if (trash === null) throw new Error("Silinemedi: bağlantı kurulamadı.");
  const current = await getReceipt(id);
  if (trash) {
    const { toplam_kdv: _generated, ...row } = current;
    void _generated;
    await supabase.from(TRASH_TABLE).delete().eq("id", id);
    const { error: trashError } = await supabase.from(TRASH_TABLE).insert({ id, receipt: row });
    if (trashError) throw new Error(`Silinemedi: ${trashError.message}`);
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) {
      await supabase.from(TRASH_TABLE).delete().eq("id", id);
      throw new Error(`Silinemedi: ${error.message}`);
    }
    return "trash";
  }
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(`Silinemedi: ${error.message}`);
  if (current.image_path) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([current.image_path]);
  return "deleted";
}

/** Muhasebeciye gönderildi işareti (`sent` false: kaldırır). @returns değişen fiş sayısı */
export async function markReceiptsSent(ids: string[], sent: boolean): Promise<number> {
  const at = sent ? new Date().toISOString() : null;
  let changed = 0;
  for (const part of chunks(ids)) {
    let query = supabase.from(TABLE).update({ muhasebe_gonderildi_at: at }).in("id", part);
    query = sent ? query.is("muhasebe_gonderildi_at", null) : query.not("muhasebe_gonderildi_at", "is", null);
    const { data, error } = await query.select("id");
    if (error) throw new Error(`İşaretlenemedi: ${error.message}`);
    changed += data?.length ?? 0;
  }
  return changed;
}

export async function getImageUrl(path: string, expiresInSec = 600): Promise<string | null> {
  const { data } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

export async function downloadBytes(path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).download(path);
  if (error || !data) throw new Error(`Görsel indirilemedi: ${error?.message ?? ""}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Kullanıcının kendi kategorileri (receipt_categories); hata olursa yalnızca hazır kategoriler kalır. */
export async function loadCustomCategories(): Promise<void> {
  const { data, error } = await supabase.from("receipt_categories").select("ad").order("created_at").order("id");
  if (error) return;
  setCustomCategories((data ?? []).map((r) => String(r.ad ?? "")).filter(Boolean));
}
