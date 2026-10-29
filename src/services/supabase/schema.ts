import { supabase } from './client';

/** 006 + 007 kurulumu: kendi kategorileri, fiş no/VKN/not/etiket, hata kayıtları, muhasebeciye gönderildi işareti */
const EXTRAS_SCHEMA_VERSION = 7;
/** 005 kurulumu (çöp kutusu; 004'ü de kapsar) */
const TRASH_SCHEMA_VERSION = 5;

/** Bilinen en yüksek sürüm; yükseldikçe yeniden sorulmaz */
let knownVersion = 0;

/**
 * Veritabanı kurulum sürümü. Fonksiyon yoksa 0; bağlantı hatası gibi belirsiz durumlarda null
 * (kullanıcıya boşuna kurulum gösterilmesin).
 */
async function schemaVersion(min: number): Promise<number | null> {
  if (knownVersion >= min) return knownVersion;
  const { data, error } = await supabase.rpc('receipt_schema_version');
  if (!error) {
    knownVersion = Math.max(knownVersion, Number(data) || 0);
    return knownVersion;
  }
  // PGRST202: fonksiyon bulunamadı → kurulum yapılmamış
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message) ? 0 : null;
}

/** 006 + 007 kurulumu (kategoriler, ek alanlar, hata kayıtları, gönderildi işareti) yapıldı mı? true / false; belirsizse null. */
export async function categoriesReady(): Promise<boolean | null> {
  const v = await schemaVersion(EXTRAS_SCHEMA_VERSION);
  return v === null ? null : v >= EXTRAS_SCHEMA_VERSION;
}

/** Çöp kutusu (005) kurulu mu? true / false; belirsizse null. */
export async function trashReady(): Promise<boolean | null> {
  const v = await schemaVersion(TRASH_SCHEMA_VERSION);
  return v === null ? null : v >= TRASH_SCHEMA_VERSION;
}
