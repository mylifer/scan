// Fiş kalemleri: yapay zekâ istemi, JSON şeması ve doğrulama. Uygulama (mobil + web) ve "kalem-doldur"
// sunucu fonksiyonu ortak kullanır; bu yüzden başka dosya içe aktarmaz (Deno ve Node'da aynen çalışır).

/** Fişteki bir ürün/hizmet satırı */
export interface FisKalemi {
  ad: string;
  /** Yoksa 1 */
  miktar: number;
  /** ADET, KG, LT…; yoksa yazılmaz */
  birim?: string;
  /** Okunamadıysa yazılmaz */
  birimFiyat?: number;
  /** Satırın KDV dahil tutarı; indirim satırlarında negatif */
  tutar: number;
  /** Satırdaki KDV oranı (1, 10, 20); okunamadıysa yazılmaz */
  kdvOrani?: number;
}

/** Bir fişten en fazla bu kadar kalem saklanır */
export const MAX_KALEM = 80;

export const KALEM_KURALLARI = `- kalemler (dizi): fişteki ürün/hizmet satırları, fişteki sırayla. Her biri: ad (ürün adı, fişte yazdığı gibi, kısaltmalar dahil), miktar (yazmıyorsa 1; "2 AD X 15,00" gibi satırlarda 2), birim (ADET, KG, LT gibi; yoksa ""), birimFiyat (yoksa 0), tutar (satırın KDV DAHİL tutarı), kdvOrani (satırın yanındaki %1/%10/%20 ya da *01/*10/*20 işaretinden sayı; yoksa 0).
- İndirim/iskonto satırlarını negatif tutarla ayrı kalem yaz. TOPLAM, ARA TOPLAM, TOPKDV, KDV dökümü, nakit/kredi kartı ödeme, para üstü, puan/bonus bilgisi ve fiş başlığı satırlarını kalem olarak YAZMA.
- Okunamayan satırı atla; tahminle ürün uydurma. Akaryakıt fişinde yakıt tek kalemdir (miktar litre, birim LT). Faturada kalemler mal/hizmet tablosundaki satırlardır (tutar KDV dahil). Hiç kalem okunamıyorsa boş dizi [] ver.`;

export const KALEM_SEMASI = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      ad: { type: 'string' },
      miktar: { type: 'number' },
      birim: { type: 'string' },
      birimFiyat: { type: 'number' },
      tutar: { type: 'number', description: 'KDV dahil satır tutarı' },
      kdvOrani: { type: 'number' },
    },
    required: ['ad', 'miktar', 'birim', 'birimFiyat', 'tutar', 'kdvOrani'],
    additionalProperties: false,
  },
} as const;

/** "1.234,56", "1234.56", 12 → sayı; geçersizse NaN */
function sayi(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  let s = v.trim().replace(/[^\d,.-]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  return s ? Number(s) : NaN;
}

const yuvarla = (n: number, b = 2) => Math.round(n * 10 ** b) / 10 ** b;

/** Modelden gelen kalem dizisini doğrular; bozuk satırlar atılır. Dizi değilse boş dizi. */
export function kalemleriAyikla(value: unknown): FisKalemi[] {
  if (!Array.isArray(value)) return [];
  const out: FisKalemi[] = [];
  for (const raw of value) {
    if (out.length >= MAX_KALEM) break;
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const ad = typeof r.ad === 'string' ? r.ad.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    const tutar = sayi(r.tutar);
    if (!ad || !Number.isFinite(tutar) || tutar === 0 || Math.abs(tutar) >= 1e9) continue;
    const m = sayi(r.miktar);
    const k: FisKalemi = { ad, miktar: Number.isFinite(m) && m > 0 && m < 1e6 ? yuvarla(m, 3) : 1, tutar: yuvarla(tutar) };
    const birim = typeof r.birim === 'string' ? r.birim.trim().toLocaleUpperCase('tr-TR').slice(0, 10) : '';
    if (birim) k.birim = birim;
    const bf = sayi(r.birimFiyat);
    if (Number.isFinite(bf) && bf > 0 && bf < 1e9) k.birimFiyat = yuvarla(bf);
    const oran = sayi(r.kdvOrani);
    if (Number.isFinite(oran) && oran > 0 && oran <= 100) k.kdvOrani = yuvarla(oran);
    out.push(k);
  }
  return out;
}

/** Kalemlerin toplamı */
export function kalemToplami(kalemler: readonly FisKalemi[]): number {
  return yuvarla(kalemler.reduce((t, k) => t + k.tutar, 0));
}

/**
 * Kalem toplamı fiş toplamını tutuyor mu (±%1, en az 1 ₺)? Okuma kalitesinin ölçüsüdür; tutmuyorsa
 * bazı satırlar eksik/yanlış okunmuştur. Kalem yoksa false.
 */
export function kalemlerTutarli(kalemler: readonly FisKalemi[], toplamTutar: number): boolean {
  if (!kalemler.length || !(toplamTutar > 0)) return false;
  return Math.abs(kalemToplami(kalemler) - toplamTutar) <= Math.max(1, toplamTutar * 0.01);
}

export type KalemKaynagi = 'tarama' | 'geriye_donuk';

/** receipt_items tablosuna yazılacak satırlar */
export function kalemSatirlari(receiptId: string, kalemler: readonly FisKalemi[], kaynak: KalemKaynagi, userId?: string) {
  return kalemler.slice(0, MAX_KALEM).map((k, sira) => ({
    ...(userId ? { user_id: userId } : {}),
    receipt_id: receiptId,
    sira,
    ad: k.ad,
    miktar: k.miktar,
    birim: k.birim ?? null,
    birim_fiyat: k.birimFiyat ?? null,
    tutar: k.tutar,
    kdv_orani: k.kdvOrani ?? null,
    kaynak,
  }));
}

/** receipt_items satırını kaleme çevirir (numeric sütunlar metin gelebilir) */
export function satirdanKalem(row: Record<string, unknown>): FisKalemi {
  const k: FisKalemi = { ad: String(row.ad ?? ''), miktar: Number(row.miktar ?? 1), tutar: Number(row.tutar ?? 0) };
  if (typeof row.birim === 'string' && row.birim) k.birim = row.birim;
  if (row.birim_fiyat !== null && row.birim_fiyat !== undefined) k.birimFiyat = Number(row.birim_fiyat);
  if (row.kdv_orani !== null && row.kdv_orani !== undefined) k.kdvOrani = Number(row.kdv_orani);
  return k;
}
