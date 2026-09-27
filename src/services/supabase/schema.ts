import { supabase } from './client';

/** Uygulamanın beklediği veritabanı sürümü (005: fiş no, vergi no, ödeme, not; tüm kategoriler) */
export const CURRENT_SCHEMA_VERSION = 5;

let cached: number | null = null;

/**
 * Veritabanı kurulum sürümü: 0 = hiç ek kurulum yok; null = bağlantı hatası gibi
 * belirsiz durum (kullanıcıya boşuna kurulum gösterilmesin).
 */
export async function getSchemaVersion(): Promise<number | null> {
  if (cached !== null && cached >= CURRENT_SCHEMA_VERSION) return cached;
  const { data, error } = await supabase.rpc('receipt_schema_version');
  if (!error) {
    cached = Number(data) || 0;
    return cached;
  }
  // PGRST202: fonksiyon bulunamadı → hiçbir kurulum yapılmamış
  if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) {
    cached = 0;
    return 0;
  }
  return cached;
}

/** Güncel kurulum yapıldı mı? true / false / null (belirsiz) */
export async function schemaReady(): Promise<boolean | null> {
  const v = await getSchemaVersion();
  return v === null ? null : v >= CURRENT_SCHEMA_VERSION;
}

/** Fiş no / vergi no / ödeme / not sütunları var mı? (yoksa bu alanlar gönderilmez) */
export async function hasDetailColumns(): Promise<boolean> {
  return ((await getSchemaVersion()) ?? 0) >= 5;
}
