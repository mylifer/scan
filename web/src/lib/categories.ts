import {
  allCategories,
  categoryLabel,
  categoryNameError,
  cleanCategoryName,
  customCategories,
  setCustomCategories,
} from "@shared/lib/categories";
import type { Kategori } from "@shared/types/receipt";
import { supabase } from "@/lib/supabase";

export { allCategories, categoryLabel };

const TABLE = "receipt_categories";
const RECEIPTS = "receipts";

export async function fetchCustomCategories(): Promise<string[]> {
  const { data, error } = await supabase.from(TABLE).select("ad").order("created_at").order("id");
  if (error) {
    return [];
  }
  const names = (data ?? []).map((r) => String(r.ad ?? "")).filter(Boolean);
  setCustomCategories(names);
  return names;
}

export async function addCustomCategory(name: string): Promise<string> {
  const problem = categoryNameError(name);
  if (problem) throw new Error(problem);
  const ad = cleanCategoryName(name);

  const { error } = await supabase.from(TABLE).insert({ ad });
  if (error) {
    if (error.code === "23505") throw new Error(`"${ad}" kategorisi zaten var.`);
    throw new Error(`Kategori eklenemedi: ${error.message}`);
  }

  setCustomCategories([...customCategories(), ad]);
  return ad;
}

export async function renameCustomCategory(from: string, to: string): Promise<number> {
  const problem = categoryNameError(to, undefined, from);
  if (problem) throw new Error(problem);
  const ad = cleanCategoryName(to);
  if (ad === from) return 0;

  const { error } = await supabase.from(TABLE).update({ ad }).eq("ad", from);
  if (error) {
    if (error.code === "23505") throw new Error(`"${ad}" kategorisi zaten var.`);
    throw new Error(`Kategori değiştirilemedi: ${error.message}`);
  }

  setCustomCategories(customCategories().map((c) => (c === from ? ad : c)));

  // Fişleri taşı
  const { data: moved, error: moveError } = await supabase
    .from(RECEIPTS)
    .update({ kategori: ad })
    .eq("kategori", from)
    .select("id");

  if (moveError) throw new Error(`Fişler güncellenemedi: ${moveError.message}`);
  return moved?.length ?? 0;
}

export async function deleteCustomCategory(name: string, moveTo: Kategori = "diğer"): Promise<number> {
  // Önce fişleri taşı
  const { data: moved, error: moveError } = await supabase
    .from(RECEIPTS)
    .update({ kategori: moveTo })
    .eq("kategori", name)
    .select("id");

  if (moveError) throw new Error(`Fişler taşınamadı: ${moveError.message}`);

  // Sonra kategoriyi sil
  const { error } = await supabase.from(TABLE).delete().eq("ad", name);
  if (error) throw new Error(`Kategori silinemedi: ${error.message}`);

  setCustomCategories(customCategories().filter((c) => c !== name));
  return moved?.length ?? 0;
}

export async function fetchCategoryCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from(RECEIPTS)
      .select("kategori")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const k = String(r.kategori ?? "");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (!data || data.length < PAGE) break;
  }
  return counts;
}
