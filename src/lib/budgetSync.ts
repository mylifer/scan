/** Yalnızca kullanılan Supabase metodları (mobil ve web farklı supabase-js kopyası kullanır) */
type Sonuc<T> = PromiseLike<{ data: T; error: { code?: string; message: string } | null }>;
interface ButceSorgusu {
  from(table: string): {
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): Sonuc<{ aylik_butce?: unknown } | null> } };
    upsert(row: Record<string, unknown>, options: { onConflict: string }): Sonuc<unknown>;
  };
}
/** Supabase istemcisi; derin tip karşılaştırması yapılmasın diye yalnızca `from` aranır */
export interface ButceIstemcisi {
  from(table: string): unknown;
}
const sorgu = (c: ButceIstemcisi) => c as unknown as ButceSorgusu;

/**
 * Aylık bütçenin bulut kopyası (user_settings, 008 kurulumu). Mobil ve web ortak kullanır.
 * Cihazdaki kopya anında açılış ve internetsiz kullanım içindir; bulut, cihazlar arası doğru kaynaktır.
 */
const TABLE = 'user_settings';

/** Buluttaki durum: tablo yok (kurulum yapılmamış), satır yok ya da kayıtlı değer (null: bütçe kaldırılmış) */
export type UzakButce = { durum: 'kurulu-degil' } | { durum: 'yok' } | { durum: 'var'; deger: number | null };

const tabloYok = (code?: string) => code === 'PGRST205' || code === '42P01';

export const gecerliButce = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

/** Buluttaki bütçeyi okur. Ağ/sunucu hatasında hata fırlatır (cihazdaki değer kalır). */
export async function uzakButceOku(client: ButceIstemcisi, userId: string): Promise<UzakButce> {
  const { data, error } = await sorgu(client).from(TABLE).select('aylik_butce').eq('user_id', userId).maybeSingle();
  if (error) {
    if (tabloYok(error.code)) return { durum: 'kurulu-degil' };
    throw new Error(error.message);
  }
  return data ? { durum: 'var', deger: gecerliButce(data.aylik_butce) } : { durum: 'yok' };
}

/** Bütçeyi buluta yazar. Tablo yoksa false döner; ağ/sunucu hatasında hata fırlatır. */
export async function uzakButceYaz(client: ButceIstemcisi, userId: string, deger: number | null): Promise<boolean> {
  const { error } = await sorgu(client)
    .from(TABLE)
    .upsert({ user_id: userId, aylik_butce: gecerliButce(deger), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    if (tabloYok(error.code)) return false;
    throw new Error(error.message);
  }
  return true;
}

/**
 * Cihaz ve bulut değerini birleştirir. Bulutta kayıt varsa o geçerlidir (başka cihazda değiştirilmiş olabilir).
 * Bulutta kayıt yoksa cihazdaki değer buluta taşınır (ilk eşitleme). Kurulum yoksa cihaz değeri kalır.
 */
export function butceBirlestir(cihaz: number | null, uzak: UzakButce): { deger: number | null; buluta: boolean } {
  if (uzak.durum === 'var') return { deger: uzak.deger, buluta: false };
  if (uzak.durum === 'yok') return { deger: cihaz, buluta: cihaz !== null };
  return { deger: cihaz, buluta: false };
}

/** Bulut erişimi (testlerde sahte verilebilir) */
export interface ButceUzak {
  oku: (userId: string) => Promise<UzakButce>;
  yaz: (userId: string, deger: number | null) => Promise<boolean>;
}

export function supabaseButceUzak(client: ButceIstemcisi): ButceUzak {
  return { oku: (u) => uzakButceOku(client, u), yaz: (u, d) => uzakButceYaz(client, u, d) };
}

/**
 * Cihaz ile bulutu eşitler. bekleyen: cihazda buluta yazılamamış bir değişiklik var (internetsiz kaydedildi);
 * o zaman bulut okunmaz, cihaz değeri yazılır. Dönüş: geçerli değer ve bekleyen işaretinin yeni hâli;
 * buluta ulaşılamazsa null (cihaz değeri olduğu gibi kalır).
 */
export async function butceEsitle(
  uzak: ButceUzak,
  userId: string,
  cihaz: number | null,
  bekleyen: boolean,
): Promise<{ deger: number | null; bekleyen: boolean } | null> {
  try {
    if (bekleyen) {
      await uzak.yaz(userId, cihaz);
      return { deger: cihaz, bekleyen: false };
    }
    const b = butceBirlestir(cihaz, await uzak.oku(userId));
    if (b.buluta) await uzak.yaz(userId, b.deger);
    return { deger: b.deger, bekleyen: false };
  } catch {
    return null;
  }
}

/** Ekranlar açıldıkça buluttan en fazla bu sıklıkla yeniden okunur */
export const BUTCE_ESITLEME_ARALIGI_MS = 60_000;
