import { supabase } from './client';

/** 004 kurulumu (giyim dahil tüm kategoriler) */
const CATEGORIES_SCHEMA_VERSION = 4;

let categoriesReadyCache = false;

/**
 * Yeni kategoriler için 004 kurulumu yapıldı mı? true / false; bağlantı hatası gibi
 * belirsiz durumlarda null (kullanıcıya boşuna kurulum gösterilmesin).
 */
export async function categoriesReady(): Promise<boolean | null> {
  if (categoriesReadyCache) return true;
  const { data, error } = await supabase.rpc('receipt_schema_version');
  if (!error) {
    categoriesReadyCache = Number(data) >= CATEGORIES_SCHEMA_VERSION;
    return categoriesReadyCache;
  }
  // PGRST202: fonksiyon bulunamadı → kurulum yapılmamış
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message) ? false : null;
}
