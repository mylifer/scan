/**
 * Hazır kategoriler. Sıra, kategori seçicide ve yapay zekâ isteminde kullanılır; "diğer" hep sonda.
 * Kullanıcı bunlara kendi kategorilerini ekleyebilir (receipt_categories tablosu, bkz. lib/categories).
 */
export const KATEGORILER = [
  'akaryakıt',
  'restoran',
  'market',
  'teknoloji',
  'ofis gideri',
  'ulaşım',
  'araç bakım',
  'konaklama',
  'iletişim',
  'faturalar',
  'kargo',
  'giyim',
  'sağlık',
  'eğitim',
  'kira',
  'sigorta',
  'abonelik',
  'reklam',
  'vergi ve harç',
  'banka masrafı',
  'yapı market',
  'kişisel bakım',
  'hediye',
  'eğlence',
  'diğer',
] as const;

/** 006 kurulumundan önce veritabanının kabul ettiği kategoriler (004/005 kuralı) */
export const ESKI_KATEGORILER: readonly string[] = [
  'akaryakıt',
  'restoran',
  'market',
  'teknoloji',
  'ofis gideri',
  'ulaşım',
  'araç bakım',
  'konaklama',
  'iletişim',
  'faturalar',
  'kargo',
  'giyim',
  'diğer',
];

export type HazirKategori = (typeof KATEGORILER)[number];
/** Hazır kategorilerden biri ya da kullanıcının kendi eklediği bir kategori adı */
export type Kategori = string;

export const KATEGORI_ETIKETLERI: Record<HazirKategori, string> = {
  akaryakıt: 'Akaryakıt',
  restoran: 'Restoran',
  market: 'Market',
  teknoloji: 'Teknoloji',
  'ofis gideri': 'Ofis Gideri',
  ulaşım: 'Ulaşım',
  'araç bakım': 'Araç Bakım',
  konaklama: 'Konaklama',
  iletişim: 'İletişim',
  faturalar: 'Faturalar',
  kargo: 'Kargo',
  giyim: 'Giyim',
  sağlık: 'Sağlık',
  eğitim: 'Eğitim',
  kira: 'Kira',
  sigorta: 'Sigorta',
  abonelik: 'Abonelik',
  reklam: 'Reklam',
  'vergi ve harç': 'Vergi ve Harç',
  'banka masrafı': 'Banka Masrafı',
  'yapı market': 'Yapı Market',
  'kişisel bakım': 'Kişisel Bakım',
  hediye: 'Hediye',
  eğlence: 'Eğlence',
  diğer: 'Diğer',
};

/** Fiş formundaki alanlar (okuma sırasında emin olunamayanları işaretlemek için) */
export const RECEIPT_FIELDS = ['firmaAdi', 'tarih', 'toplamTutar', 'kdvYuzde1', 'kdvYuzde10', 'kdvYuzde20', 'kategori', 'fisNo', 'vkn'] as const;
export type ReceiptField = (typeof RECEIPT_FIELDS)[number];

/** Görüntü okuma servisinin döndürdüğü, form üzerinde düzenlenen fiş verisi. */
export interface ReceiptData {
  firmaAdi: string;
  /** DD.MM.YYYY */
  tarih: string;
  toplamTutar: number;
  kdvYuzde1: number;
  kdvYuzde10: number;
  kdvYuzde20: number;
  kategori: Kategori;
  /** Fişteki "FİŞ NO" (boşsa yok) */
  fisNo?: string;
  /** Fişi kesen firmanın vergi kimlik no (10 hane) ya da TC kimlik no (11 hane) */
  vkn?: string;
  /** Kullanıcının notu */
  notlar?: string;
  /** Kullanıcının etiketleri (ör. "X projesi", "müşteri yemeği") */
  etiketler?: string[];
  /** Yapay zekânın fişte net okuyamadığı alanlar (yalnızca okuma sonucunda; kaydedilmez) */
  eminOlunmayanlar?: ReceiptField[];
}

/** Supabase'deki kayıt (receipts tablosu). */
export interface ReceiptRecord {
  id: string;
  created_at: string;
  firma_adi: string;
  /** YYYY-MM-DD */
  tarih: string;
  toplam_tutar: number;
  kdv_yuzde1: number;
  kdv_yuzde10: number;
  kdv_yuzde20: number;
  toplam_kdv: number;
  kategori: Kategori;
  image_path: string | null;
  fis_no: string | null;
  vkn: string | null;
  notlar: string | null;
  etiketler: string[];
}

export type DraftStatus = 'pending' | 'scheduled' | 'processing' | 'ready' | 'failed';

/** Toplu taramada çekilmiş, henüz kaydedilmemiş fiş (receipt_drafts tablosu). */
export interface ReceiptDraft {
  id: string;
  created_at: string;
  image_path: string;
  status: DraftStatus;
  scheduled_for: string | null;
  result: ReceiptData | null;
  error: string | null;
}
