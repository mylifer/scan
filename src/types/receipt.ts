/** Sıra, kategori seçicide ve Gemini şemasında kullanılır. Yeni kategori: yeni bir migration ekleyip SCHEMA_SETUP_SQL'i güncelleyin. */
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
  'diğer',
] as const;

/** 003 kurulumundan önce veritabanının kabul ettiği kategoriler */
export const ESKI_KATEGORILER: readonly Kategori[] = ['akaryakıt', 'restoran', 'market', 'teknoloji', 'ofis gideri'];
export type Kategori = (typeof KATEGORILER)[number];

export const KATEGORI_ETIKETLERI: Record<Kategori, string> = {
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
  diğer: 'Diğer',
};

export const ODEME_SEKILLERI = ['kart', 'nakit', 'diğer'] as const;
export type OdemeSekli = (typeof ODEME_SEKILLERI)[number];
export const ODEME_ETIKETLERI: Record<OdemeSekli, string> = { kart: 'Kart', nakit: 'Nakit', diğer: 'Diğer' };

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
  /** Fiş numarası ("FİŞ NO") */
  fisNo?: string;
  /** Satıcının vergi no (VKN, 10 hane) ya da TCKN (11 hane) */
  vergiNo?: string;
  odeme?: OdemeSekli | null;
  notlar?: string;
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
  /** 005 kurulumundan önce bu alanlar veritabanında yoktur (null) */
  fis_no?: string | null;
  vergi_no?: string | null;
  odeme?: OdemeSekli | null;
  notlar?: string | null;
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
