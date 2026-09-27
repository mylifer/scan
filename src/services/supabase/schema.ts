import { supabase } from './client';

let categoriesReadyCache = false;

/**
 * Yeni kategoriler için 003 kurulumu yapıldı mı? true / false; bağlantı hatası gibi
 * belirsiz durumlarda null (kullanıcıya boşuna kurulum gösterilmesin).
 */
export async function categoriesReady(): Promise<boolean | null> {
  if (categoriesReadyCache) return true;
  const { data, error } = await supabase.rpc('receipt_schema_version');
  if (!error) {
    categoriesReadyCache = Number(data) >= 3;
    return categoriesReadyCache;
  }
  // PGRST202: fonksiyon bulunamadı → kurulum yapılmamış
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message) ? false : null;
}
