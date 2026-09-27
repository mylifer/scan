import type { ReceiptRecord } from '../types/receipt';

const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** "MİGROS Ticaret" → "migros ticaret": Türkçe büyük/küçük harf ve aksanlardan bağımsız karşılaştırma için */
export function normalizeForSearch(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]/g, (c) => TR[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Firma adında ya da tutarda (ör. "337" → ₺337,30) arar. Boş sorgu her şeyle eşleşir. */
export function matchesReceipt(r: Pick<ReceiptRecord, 'firma_adi' | 'toplam_tutar'>, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  if (normalizeForSearch(r.firma_adi).includes(q)) return true;
  // Tutar araması: "337", "337,3", "337.30", "1.500" gibi girdiler
  const digits = q.replace(/\s/g, '');
  if (/^[\d.,]+$/.test(digits)) {
    const amount = r.toplam_tutar.toFixed(2); // "1500.00"
    const typed = digits.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); // binlik noktalarını at
    return amount.startsWith(typed) || amount.replace('.', ',').startsWith(digits);
  }
  return false;
}

const FIRM_NOISE = new Set(['a', 's', 'as', 'ao', 'ltd', 'sti', 'tic', 'ticaret', 'san', 'sanayi', 've', 'anonim', 'sirketi', 'limited', 'ith', 'ihr', 'paz', 'pazarlama']);

/** "MİGROS TİCARET A.Ş." ve "Migros Tic. AŞ" → "migros": şirket türü eklerinden bağımsız firma anahtarı */
export function firmKey(name: string): string {
  return normalizeForSearch(name)
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter((w) => w && !FIRM_NOISE.has(w))
    .join(' ');
}

/**
 * Kullanıcının bu firma için daha önce seçtiği kategori (en yeni fiş; `rows` yeniden eskiye sıralı).
 * Yapay zekânın tahmini yerine kullanıcının kendi tercihi kullanılsın diye.
 */
export function learnedCategoryFor<K extends string>(rows: { firma_adi: string; kategori: K }[], firmaAdi: string): K | null {
  const key = firmKey(firmaAdi);
  if (!key) return null;
  return rows.find((r) => firmKey(r.firma_adi) === key)?.kategori ?? null;
}
