import { useSyncExternalStore } from 'react';

import { type HazirKategori, type Kategori, KATEGORI_ETIKETLERI, KATEGORILER } from '../types/receipt';
import { normalizeForSearch } from './search';

/** Kendi kategori adının en fazla uzunluğu (veritabanı kuralıyla aynı) */
export const MAX_CATEGORY_LENGTH = 40;

let custom: readonly string[] = [];
let snapshot: readonly Kategori[] = buildAll(custom);
const listeners = new Set<() => void>();

function buildAll(list: readonly string[]): readonly Kategori[] {
  const builtins = KATEGORILER.filter((k) => k !== 'diğer');
  return [...builtins, ...list, 'diğer'];
}

export function isBuiltinCategory(k: string): k is HazirKategori {
  return (KATEGORILER as readonly string[]).includes(k);
}

/** Kullanıcının kendi eklediği kategoriler (eklenme sırasıyla) */
export function customCategories(): readonly string[] {
  return custom;
}

/** Seçicide gösterilen tüm kategoriler: hazırlar, kullanıcınınkiler, en sonda "diğer" */
export function allCategories(): readonly Kategori[] {
  return snapshot;
}

/** Kendi kategorileri değişince (açılışta yüklenince, eklenince, silinince) çağrılır */
export function setCustomCategories(list: readonly string[]) {
  const clean: string[] = [];
  for (const raw of list) {
    const name = cleanCategoryName(raw);
    if (name && !KATEGORILER.some((k) => sameCategoryName(k, name)) && !clean.some((c) => sameCategoryName(c, name))) clean.push(name);
  }
  if (clean.length === custom.length && clean.every((c, i) => c === custom[i])) return;
  custom = clean;
  snapshot = buildAll(custom);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ekranlarda canlı kategori listesi */
export function useCategories(): readonly Kategori[] {
  return useSyncExternalStore(subscribe, allCategories, allCategories);
}

/** "  iş   yemeği " → "iş yemeği" (fazla boşluklar atılır, uzunluk sınırlanır) */
export function cleanCategoryName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_CATEGORY_LENGTH).trim();
}

/** Büyük/küçük harf ve Türkçe karakter farkı gözetmeden aynı ad mı ("Kırtasiye" = "kirtasiye") */
export function sameCategoryName(a: string, b: string): boolean {
  return normalizeForSearch(a) === normalizeForSearch(b);
}

/** Listede bu ada denk gelen kategori (yoksa undefined) */
export function findCategory(name: string, list: readonly Kategori[] = snapshot): Kategori | undefined {
  const n = normalizeForSearch(name);
  return n ? list.find((k) => normalizeForSearch(k) === n) : undefined;
}

/**
 * Yeni kategori adı geçerli mi? Hata varsa açıklaması, yoksa null.
 * `except`: yeniden adlandırılan kategorinin eski adı (kendisiyle çakışmış sayılmaz)
 */
export function categoryNameError(name: string, list: readonly Kategori[] = snapshot, except?: string): string | null {
  const clean = cleanCategoryName(name);
  if (!clean) return 'Kategori adı boş olamaz.';
  if (name.trim().replace(/\s+/g, ' ').length > MAX_CATEGORY_LENGTH) return `Kategori adı en fazla ${MAX_CATEGORY_LENGTH} karakter olabilir.`;
  const existing = findCategory(clean, list);
  if (existing && existing !== except) return `"${categoryLabel(existing)}" kategorisi zaten var.`;
  return null;
}

/** Ekranda görünen ad: hazır kategoride sabit etiket, kullanıcınınkinde ilk harf büyük */
export function categoryLabel(k: Kategori): string {
  if (isBuiltinCategory(k)) return KATEGORI_ETIKETLERI[k];
  return k ? k.charAt(0).toLocaleUpperCase('tr-TR') + k.slice(1) : 'Diğer';
}
