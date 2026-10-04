/**
 * Aynı firmanın farklı yazımlarını bulur ("MİGROS TİCARET A.Ş.", "Migros", "MIGROS").
 * Adlar sadeleştirilir (Türkçe harfler, noktalama, şirket türü ekleri) ve biri diğerinin
 * kelime kelime başı olan adlar aynı grupta toplanır. Gruplar yalnızca öneridir: kullanıcı onaylar.
 */
const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** Şirket türü ve sektör ekleri: firmayı ayırt etmez */
const STOP = new Set([
  'a', 's', 'as', 'aş', 'anonim', 'sirketi', 'sirket', 'ltd', 'limited', 'sti', 'tic', 'ticaret', 'san', 'sanayi', 've',
  'paz', 'pazarlama', 'ith', 'ihr', 'ithalat', 'ihracat', 'tur', 'turizm', 'insaat', 'magazacilik', 'magazalari',
  'hiz', 'hizmetleri', 'koll', 'kollektif', 'subesi', 'sube', 'tas', 'ltdsti', 'aş',
]);

export function firmTokens(name: string): string[] {
  return name
    .toLocaleLowerCase('tr-TR')
    .replace(/i̇/g, 'i')
    .replace(/[çğıöşü]/g, (c) => TR[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.']/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w));
}

export interface FirmVariant {
  name: string;
  count: number;
}

export interface FirmGroup {
  /** Önerilen ortak ad: en çok kullanılan yazım (eşitlikte en uzun) */
  suggested: string;
  variants: FirmVariant[];
  total: number;
}

const isPrefix = (a: string[], b: string[]) => a.length <= b.length && a.every((w, i) => w === b[i]);

/** @param names firma adı → fiş sayısı */
export function findFirmGroups(names: Map<string, number>): FirmGroup[] {
  const items = [...names.entries()]
    .map(([name, count]) => ({ name, count, tokens: firmTokens(name) }))
    .filter((x) => x.tokens.length > 0)
    .sort((a, b) => a.tokens.length - b.tokens.length || a.name.localeCompare(b.name, 'tr'));
  // Birleşim-bul: biri diğerinin başıysa aynı grup
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i]!.tokens[0] !== items[j]!.tokens[0]) continue;
      if (isPrefix(items[i]!.tokens, items[j]!.tokens)) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, FirmVariant[]>();
  items.forEach((x, i) => {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), { name: x.name, count: x.count }]);
  });
  return [...groups.values()]
    .filter((v) => v.length > 1)
    .map((variants) => {
      const sorted = [...variants].sort((a, b) => b.count - a.count || b.name.length - a.name.length || a.name.localeCompare(b.name, 'tr'));
      return { suggested: sorted[0]!.name, variants: sorted, total: sorted.reduce((a, v) => a + v.count, 0) };
    })
    .sort((a, b) => b.total - a.total || a.suggested.localeCompare(b.suggested, 'tr'));
}
