/** Sıra, kategori seçicide ve Gemini şemasında kullanılır. Yeni kategori: yeni bir migration ekleyip CATEGORIES_SETUP_SQL'i güncelleyin. */
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

/** Fiş formundaki alanlar (okuma sırasında emin olunamayanları işaretlemek için) */
export const RECEIPT_FIELDS = ['firmaAdi', 'tarih', 'toplamTutar', 'kdvYuzde1', 'kdvYuzde10', 'kdvYuzde20', 'kategori'] as const;
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
