import { categoryNameError, cleanCategoryName, customCategories, setCustomCategories } from '../../lib/categories';
import { readCache, writeCache } from '../../lib/offlineCache';
import type { Kategori } from '../../types/receipt';
import { supabase } from './client';
import { invalidateFirmCategories } from './receiptsRepository';

const TABLE = 'receipt_categories';
const RECEIPTS = 'receipts';
const CACHE_SLOT = 'categories:v1';

/** Tablo henüz yok (006 kurulumu yapılmamış) */
const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|does not exist/i.test(e.message ?? ''));

/**
 * Kullanıcının kendi kategorilerini yükler: önce cihazdaki kopya (anında, çevrimdışı), sonra sunucu.
 * Hata fırlatmaz; kategoriler yüklenemezse yalnızca hazır kategoriler görünür.
 */
export async function loadCustomCategories(owner: string): Promise<void> {
  if (!owner) {
    setCustomCategories([]);
    return;
  }
  const cached = await readCache<string[]>(CACHE_SLOT, owner);
  if (cached) setCustomCategories(cached.value);
  try {
    const { data, error } = await supabase.from(TABLE).select('ad').order('created_at').order('id');
    if (error) {
      if (missingTable(error)) setCustomCategories([]);
      return;
    }
    const names = (data ?? []).map((r) => String(r.ad ?? '')).filter(Boolean);
    setCustomCategories(names);
    writeCache(CACHE_SLOT, owner, [...customCategories()]);
  } catch {
    // çevrimdışı: önbellekteki liste kalır
  }
}

async function saveCache() {
  const owner = (await supabase.auth.getSession()).data.session?.user.id;
  if (owner) writeCache(CACHE_SLOT, owner, [...customCategories()]);
}

/** Yeni kategori ekler; eklenen (temizlenmiş) adı döner */
export async function addCustomCategory(name: string): Promise<Kategori> {
  const problem = categoryNameError(name);
  if (problem) throw new Error(problem);
  const ad = cleanCategoryName(name);
  const { error } = await supabase.from(TABLE).insert({ ad });
  if (error) {
    if (error.code === '23505') throw new Error(`"${ad}" kategorisi zaten var.`);
    if (missingTable(error)) throw new Error('Kendi kategorinizi eklemek için önce ana sayfadaki "Veritabanını güncelle" adımını tamamlayın.');
    throw new Error(`Kategori eklenemedi: ${error.message}`);
  }
  setCustomCategories([...customCategories(), ad]);
  await saveCache();
  return ad;
}

/** Kategorinin adını değiştirir; o kategorideki fişler de yeni ada taşınır. @returns taşınan fiş sayısı */
export async function renameCustomCategory(from: string, to: string): Promise<number> {
  const problem = categoryNameError(to, undefined, from);
  if (problem) throw new Error(problem);
  const ad = cleanCategoryName(to);
  if (ad === from) return 0;
  const { error } = await supabase.from(TABLE).update({ ad }).eq('ad', from);
  if (error) {
    if (error.code === '23505') throw new Error(`"${ad}" kategorisi zaten var.`);
    throw new Error(`Kategori değiştirilemedi: ${error.message}`);
  }
  // Liste hemen güncellensin; fişler ardından taşınır
  setCustomCategories(customCategories().map((c) => (c === from ? ad : c)));
  await saveCache();
  return moveReceipts(from, ad);
}

/** Kategoriyi siler; içindeki fişler `moveTo` kategorisine (varsayılan "diğer") taşınır. @returns taşınan fiş sayısı */
export async function deleteCustomCategory(name: string, moveTo: Kategori = 'diğer'): Promise<number> {
  // Önce fişler taşınır: kategori silinip taşıma yarım kalırsa fişler listede olmayan bir kategoride kalmasın
  const moved = await moveReceipts(name, moveTo);
  const { error } = await supabase.from(TABLE).delete().eq('ad', name);
  if (error) throw new Error(`Kategori silinemedi: ${error.message}`);
  setCustomCategories(customCategories().filter((c) => c !== name));
  await saveCache();
  return moved;
}

async function moveReceipts(from: string, to: Kategori): Promise<number> {
  const { data, error } = await supabase.from(RECEIPTS).update({ kategori: to }).eq('kategori', from).select('id');
  if (error) throw new Error(`Fişler taşınamadı: ${error.message}`);
  invalidateFirmCategories();
  return data?.length ?? 0;
}

/** Her kategorideki fiş sayısı (yalnızca kategori sütunu çekilir) */
export async function getCategoryCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from(RECEIPTS)
      .select('kategori')
      .order('id')
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const k = String(r.kategori ?? '');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (!data || data.length < PAGE) break;
  }
  return counts;
}
