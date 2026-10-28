import { round2 } from './format';
import { normalizeForSearch } from './search';

/** Etiket sınırları (veritabanı kuralıyla aynı) */
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 30;
export const MAX_NOTE_LENGTH = 1000;
export const MAX_FIS_NO_LENGTH = 40;

/** "0045", "FİŞ NO: 0045" → "0045": boşluk ve "No:" gibi önekler atılır */
export function cleanFisNo(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/^\s*(f[iİı][sşŞ]\s*)?no\s*[:.]?\s*/i, '')
    .replace(/\s+/g, '')
    .slice(0, MAX_FIS_NO_LENGTH);
}

/** Fiş numaraları "0045" ile "45" aynı sayılır */
export function sameFisNo(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/^0+(?=.)/, '').toLocaleUpperCase('tr-TR');
  return !!a && !!b && n(a) === n(b);
}

/** VKN/TCKN'deki boşluk, nokta, tire atılır; yalnızca rakamlar kalır */
export function cleanTaxId(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).replace(/\D/g, '');
}

/** 10 haneli vergi kimlik numarasının kontrol hanesi (Gelir İdaresi algoritması) */
export function isValidVkn(vkn: string): boolean {
  if (!/^\d{10}$/.test(vkn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const tmp = (Number(vkn[i]) + 9 - i) % 10;
    let v = (tmp * 2 ** (9 - i)) % 9;
    if (tmp !== 0 && v === 0) v = 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === Number(vkn[9]);
}

/** 11 haneli TC kimlik numarasının kontrol haneleri */
export function isValidTckn(tckn: string): boolean {
  if (!/^[1-9]\d{10}$/.test(tckn)) return false;
  const d = [...tckn].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d[9] === d10 && d[10] === d11;
}

/** Formdaki VKN/TCKN için: biçim hatası (kaydı engeller) */
export function taxIdError(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^[\d\s.-]+$/.test(v)) return 'VKN/TCKN yalnızca rakamlardan oluşmalı.';
  const digits = cleanTaxId(v);
  if (digits.length !== 10 && digits.length !== 11) return 'VKN 10, TCKN 11 haneli olmalı.';
  return null;
}

/** Biçimi doğru ama kontrol hanesi tutmuyorsa uyarı (okuma hatası olabilir; kaydı engellemez) */
export function taxIdWarning(value: string): string | null {
  const digits = cleanTaxId(value);
  if (taxIdError(value) || !digits) return null;
  const ok = digits.length === 10 ? isValidVkn(digits) : isValidTckn(digits);
  return ok ? null : `${digits.length === 10 ? 'VKN' : 'TCKN'} geçerli görünmüyor (kontrol hanesi tutmuyor). Rakamları fişle karşılaştırın.`;
}

/**
 * "X projesi, #müşteri yemeği,  x projesi" → ["X projesi", "müşteri yemeği"]
 * Virgül ya da noktalı virgülle ayrılır; baştaki # atılır; tekrarlar (harf farkı gözetmeden) bir kez sayılır.
 */
export function parseTags(input: string | readonly string[]): string[] {
  const parts = typeof input === 'string' ? input.split(/[,;\n]/) : input;
  const out: string[] = [];
  for (const raw of parts) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH).trim();
    if (tag && !out.some((t) => normalizeForSearch(t) === normalizeForSearch(tag))) out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Etiket listesini formdaki metne çevirir */
export const tagsToInput = (tags: readonly string[] | undefined) => (tags ?? []).join(', ');

/** Notu temizler (baş/son boşluk, uzunluk sınırı) */
export const cleanNote = (note: string | undefined) => (note ?? '').trim().slice(0, MAX_NOTE_LENGTH);

/** Mükerrer kontrolünde karşılaştırılan alanlar */
export interface DuplicateKey {
  toplam_tutar: number;
  fis_no?: string | null;
  vkn?: string | null;
}

/**
 * Aynı tarihli iki fiş aynı fiş mi?
 * - İkisinde de fiş no varsa: numaralar farklıysa ayrı fiş; aynıysa (VKN'ler farklı değilse) mükerrer.
 *   VKN ikisinde de varsa VKN'nin eşleşmesi yeter (tutar yanlış okunmuş olabilir); yoksa tutar da eşleşmeli.
 * - Fiş no yoksa: farklı VKN'ler ayrı firma demektir; aksi hâlde tutar eşitliğine bakılır (eski davranış).
 */
export function isLikelyDuplicate(a: DuplicateKey, b: DuplicateKey): boolean {
  const sameAmount = round2(a.toplam_tutar) === round2(b.toplam_tutar);
  const vknA = a.vkn ?? '';
  const vknB = b.vkn ?? '';
  const bothVkn = !!vknA && !!vknB;
  if (bothVkn && vknA !== vknB) return false;
  const fisA = a.fis_no ?? '';
  const fisB = b.fis_no ?? '';
  if (fisA && fisB) {
    if (!sameFisNo(fisA, fisB)) return false;
    return bothVkn || sameAmount;
  }
  return sameAmount;
}
