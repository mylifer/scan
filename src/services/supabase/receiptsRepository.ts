import { errorMessage } from '../../lib/errors';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { receiptImageName, round2, trDateToIso } from '../../lib/format';
import { isLikelyDuplicate } from '../../lib/receiptExtras';
import { type PeriodSummary, summarizeReceipts } from '../../lib/summary';
import { learnedCategoryFor } from '../../lib/search';
import { buildMonthlySeries, type MonthPoint } from '../../lib/trend';
import { fisAyaAitMi, fisKdvAyi, simdikiIstanbulAyi } from '../../lib/kdvAy';
import type { Kategori, ReceiptData, ReceiptRecord } from '../../types/receipt';
import { trashCutoff } from '../../lib/trash';
import { supabase } from './client';
import { chunks, extraColumns, toRecord } from './receiptRows';
import { trashReady } from './schema';

const TABLE = 'receipts';
const TRASH_TABLE = 'receipt_trash';
export const RECEIPT_IMAGES_BUCKET = 'receipt-images';

export interface SaveResult {
  record: ReceiptRecord;
  /** Görsel yüklenemediyse fiş yine kaydedilir; bu alan uyarı içerir. */
  imageWarning?: string;
}

export async function saveReceipt(data: ReceiptData, archiveUri?: string): Promise<SaveResult> {
  const tarih = trDateToIso(data.tarih);
  if (!tarih) throw new Error('Tarih DD.MM.YYYY formatında olmalı.');

  const userId = await currentUserId();

  let imagePath: string | null = null;
  let imageWarning: string | undefined;
  if (archiveUri) {
    try {
      imagePath = await uploadImage(`${userId}/${receiptImageName(tarih, data.firmaAdi)}.jpg`, archiveUri);
    } catch (e) {
      imageWarning = `Fiş görseli yüklenemedi: ${errorMessage(e)}`;
    }
  }

  const { data: record, error } = await supabase
    .from(TABLE)
    .insert({
      firma_adi: data.firmaAdi.trim(),
      tarih,
      toplam_tutar: round2(data.toplamTutar),
      kdv_yuzde1: round2(data.kdvYuzde1),
      kdv_yuzde10: round2(data.kdvYuzde10),
      kdv_yuzde20: round2(data.kdvYuzde20),
      kategori: data.kategori,
      image_path: imagePath,
      ...extraColumns(data),
    })
    .select()
    .single();

  if (error) {
    if (imagePath) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([imagePath]);
    throw new Error(`Kayıt başarısız: ${error.message}`);
  }
  invalidateFirmCategories();
  return { record: toRecord(record), imageWarning };
}

export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Oturum bulunamadı, lütfen tekrar giriş yapın.');
  return data.user.id;
}

export function uniqueName(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Yerel görseli (web: blob URL, native: dosya URI) Storage'a yükler ve yolunu döner. */
export async function uploadImage(path: string, uri: string): Promise<string> {
  const bytes =
    Platform.OS === 'web' ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  const { error } = await supabase.storage
    .from(RECEIPT_IMAGES_BUCKET)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function getReceiptImageUrl(path: string, expiresInSec = 300): Promise<string | null> {
  const { data } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? null;
}

export type { PeriodSummary } from '../../lib/summary';
export { recordToData } from './receiptRows';

/** Supabase tek istekte en fazla 1000 satır döndürür; daha fazlası sayfalanarak alınır. */
const PAGE_SIZE = 1000;

/**
 * Seçilen dönemi özetler. `range` verilmezse tüm zamanlar.
 * range: [from, to) aralığı, YYYY-MM-DD
 */
export async function getSummary(range?: { from: string; to: string }): Promise<PeriodSummary> {
  const rows: ReceiptRecord[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(TABLE).select('*');
    if (range) query = query.gte('tarih', range.from).lt('tarih', range.to);
    const { data, error } = await query
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })
      // Benzersiz son sıralama anahtarı: sayfa sınırlarında satır atlanmasın/tekrarlanmasın
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []).map(toRecord));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return summarizeReceipts(rows);
}

/**
 * KDV hesabı için döneme ait fişler:
 * 1) Bu ay muhasebeciye gönderilmiş fişler (fiş tarihi eski/farklı olsa bile bu ay indirilir).
 * 2) Henüz gönderilmemiş fişler mevcut ayda indirilir (önceki aylardan devredenler dahil).
 * Başka bir ay muhasebeciye gönderilmiş fişler (fiş tarihi bu ay olsa bile) hariç tutulur.
 */
export async function getKdvReceipts(range: { from: string; to: string }): Promise<ReceiptRecord[]> {
  const month = range.from.slice(0, 7);
  const currentMonth = simdikiIstanbulAyi();
  const tzFrom = `${range.from}T00:00:00+03:00`;
  const tzTo = `${range.to}T00:00:00+03:00`;

  const rows: ReceiptRecord[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(TABLE).select('*');
    if (month === currentMonth) {
      // Mevcut ay: bu ay gönderilenler VEYA henüz gönderilmemiş olup tarihi bu ay veya öncesi olanlar
      query = query.or(
        `and(muhasebe_gonderildi_at.gte.${tzFrom},muhasebe_gonderildi_at.lt.${tzTo}),and(muhasebe_gonderildi_at.is.null,tarih.lt.${range.to})`
      );
    } else {
      // Geçmiş veya gelecek ay: fiş tarihi bu ay olanlar VEYA muhasebe_gonderildi_at bu ay olanlar
      query = query.or(
        `and(tarih.gte.${range.from},tarih.lt.${range.to}),and(muhasebe_gonderildi_at.gte.${tzFrom},muhasebe_gonderildi_at.lt.${tzTo})`
      );
    }
    const { data, error } = await query
      .order('tarih', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.warn('KDV fiş sorgusu hatası, fallback yapılıyor:', error.message);
      const fallback = await getSummary(month === currentMonth ? { from: '2000-01-01', to: range.to } : range);
      return fallback.fisler.filter((r) => fisAyaAitMi(r, month, currentMonth));
    }
    rows.push(...(data ?? []).map(toRecord));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows.filter((r) => fisAyaAitMi(r, month, currentMonth));
}

/** Son `months` ayın aylık toplamları (grafik için; yalnızca gereken sütunlar indirilir). */
export async function getMonthlyTotals(months = 12): Promise<MonthPoint[]> {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
  const rows: { tarih: string; toplam_tutar: number; toplam_kdv: number }[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('tarih,toplam_tutar,toplam_kdv')
      .gte('tarih', from)
      .order('tarih')
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) rows.push({ tarih: String(r.tarih), toplam_tutar: Number(r.toplam_tutar), toplam_kdv: Number(r.toplam_kdv) });
    if (!data || data.length < PAGE_SIZE) break;
  }
  return buildMonthlySeries(rows, months, now);
}

/** Dönemin kategori toplamları (yalnızca iki sütun çekilir; aylık içgörüde önceki ayla kıyas için). range: [from, to) */
export async function getCategoryTotals(range: { from: string; to: string }): Promise<{ kategori: Kategori; toplam: number }[]> {
  const totals = new Map<Kategori, number>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('kategori,toplam_tutar')
      .gte('tarih', range.from)
      .lt('tarih', range.to)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const k = r.kategori as Kategori;
      totals.set(k, (totals.get(k) ?? 0) + Number(r.toplam_tutar));
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return [...totals.entries()].map(([kategori, toplam]) => ({ kategori, toplam: round2(toplam) }));
}

/**
 * Aynı fiş olabilecek kayıtlar (mükerrer kayıt uyarısı için): aynı tarihli fişler arasından
 * fiş no / VKN / tutar karşılaştırmasıyla seçilir (bkz. isLikelyDuplicate).
 */
export async function findPossibleDuplicates(data: ReceiptData, excludeId?: string): Promise<ReceiptRecord[]> {
  const tarih = trDateToIso(data.tarih);
  if (!tarih) return [];
  let query = supabase.from(TABLE).select('*').eq('tarih', tarih).order('created_at', { ascending: false }).limit(200);
  if (excludeId) query = query.neq('id', excludeId);
  const { data: rows, error } = await query;
  if (error) return []; // kontrol başarısızsa kaydı engelleme
  const key = { toplam_tutar: data.toplamTutar, fis_no: data.fisNo, vkn: data.vkn };
  return (rows ?? []).map(toRecord).filter((r) => isLikelyDuplicate(key, r)).slice(0, 3);
}

/** Bu VKN/TCKN ile en son kaydedilen fişin firma adı ve kategorisi (karekodda firma adı yok) */
export async function findFirmByVkn(vkn: string): Promise<{ firma_adi: string; kategori: Kategori } | null> {
  if (!vkn) return null;
  const { data, error } = await supabase.from(TABLE).select('firma_adi, kategori').eq('vkn', vkn).order('created_at', { ascending: false }).limit(1);
  if (error || !data?.length) return null;
  return { firma_adi: String(data[0].firma_adi ?? ''), kategori: String(data[0].kategori ?? 'diğer') };
}

/** Kullanıcının daha önce kullandığı etiketler, en çok kullanılandan aza (formda öneri olarak) */
export async function getKnownTags(limit = 30): Promise<string[]> {
  const { data, error } = await supabase.from(TABLE).select('etiketler').order('created_at', { ascending: false }).limit(500);
  if (error || !data) return [];
  const counts = new Map<string, number>();
  for (const row of data) {
    for (const tag of Array.isArray(row.etiketler) ? (row.etiketler as unknown[]) : []) {
      if (typeof tag === 'string' && tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t);
}

/**
 * Kullanıcı bu firmanın bir fişini daha önce kaydettiyse o kategoriyi kullanır (AI tahmini yerine).
 * Hata olursa veriyi olduğu gibi döner; tarama akışını asla bozmaz.
 */
export async function applyLearnedCategory(data: ReceiptData): Promise<{ data: ReceiptData; learned: boolean }> {
  try {
    const rows = await recentFirmCategories();
    if (!rows) return { data, learned: false };
    const kategori = learnedCategoryFor(rows, data.firmaAdi);
    if (!kategori || kategori === data.kategori) return { data, learned: false };
    // Kategori artık kullanıcının önceki seçiminden geliyor: "emin değilim" işareti kalkar
    const eminOlunmayanlar = data.eminOlunmayanlar?.filter((f) => f !== 'kategori');
    return { data: { ...data, kategori, eminOlunmayanlar: eminOlunmayanlar?.length ? eminOlunmayanlar : undefined }, learned: true };
  } catch {
    return { data, learned: false };
  }
}

type FirmCategory = { firma_adi: string; kategori: Kategori };
/** Toplu taramada her taslak için 500 satır tekrar indirilmesin: kısa süreli, kullanıcıya bağlı bellek önbelleği */
let firmCategoryCache: { owner: string; rows: FirmCategory[]; at: number } | null = null;
/** Geçersiz kılma sayacı: kayıttan önce başlayıp sonra biten sorgu eski veriyi tekrar önbelleğe yazmasın */
let firmCacheGeneration = 0;
const FIRM_CACHE_MS = 5 * 60 * 1000;

async function recentFirmCategories(): Promise<FirmCategory[] | null> {
  const owner = (await supabase.auth.getSession()).data.session?.user.id ?? '';
  if (firmCategoryCache && firmCategoryCache.owner === owner && Date.now() - firmCategoryCache.at < FIRM_CACHE_MS) {
    return firmCategoryCache.rows;
  }
  const generation = firmCacheGeneration;
  const { data: rows, error } = await supabase
    .from(TABLE)
    .select('firma_adi, kategori')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error || !rows) return null;
  if (generation === firmCacheGeneration) firmCategoryCache = { owner, rows: rows as FirmCategory[], at: Date.now() };
  return rows as FirmCategory[];
}

/** Fiş eklenince/değişince/silinince kategori hafızası yeniden okunsun */
export function invalidateFirmCategories() {
  firmCacheGeneration++;
  firmCategoryCache = null;
}

/**
 * Yedekten bir fişi bu hesaba ekler (fotoğraf varsa önce yüklenir, bir kez yeniden denenir).
 * Fotoğraf yüklenemezse fiş de eklenmez ve hata fırlatılır: yedek yeniden yüklendiğinde fiş
 * fotoğrafıyla birlikte eklenir (fotoğrafsız eklenseydi sonraki denemede "zaten var" diye atlanırdı).
 */
export async function insertRestoredReceipt(
  userId: string,
  r: Pick<ReceiptRecord, 'firma_adi' | 'tarih' | 'toplam_tutar' | 'kdv_yuzde1' | 'kdv_yuzde10' | 'kdv_yuzde20' | 'kategori' | 'created_at'> &
    Partial<Pick<ReceiptRecord, 'fis_no' | 'vkn' | 'notlar' | 'etiketler' | 'muhasebe_gonderildi_at'>>,
  photo: Uint8Array | null,
): Promise<void> {
  let imagePath: string | null = null;
  if (photo) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2 && !imagePath; attempt++) {
      const path = `${userId}/${receiptImageName(r.tarih, r.firma_adi)}.jpg`;
      const { error } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: false });
      if (error) lastError = error;
      else imagePath = path;
    }
    if (!imagePath) throw new Error(`Fotoğraf yüklenemedi: ${errorMessage(lastError)}`);
  }
  const { error } = await supabase.from(TABLE).insert({
    firma_adi: r.firma_adi,
    tarih: r.tarih,
    toplam_tutar: round2(r.toplam_tutar),
    kdv_yuzde1: round2(r.kdv_yuzde1),
    kdv_yuzde10: round2(r.kdv_yuzde10),
    kdv_yuzde20: round2(r.kdv_yuzde20),
    kategori: r.kategori,
    image_path: imagePath,
    // Eski yedeklerde bu alanlar yok: varsa yazılır (006 öncesi veritabanında sütun hatası olmasın)
    ...(r.fis_no ? { fis_no: r.fis_no } : {}),
    ...(r.vkn ? { vkn: r.vkn } : {}),
    ...(r.notlar ? { notlar: r.notlar } : {}),
    ...(r.etiketler?.length ? { etiketler: r.etiketler } : {}),
    ...(r.muhasebe_gonderildi_at ? { muhasebe_gonderildi_at: r.muhasebe_gonderildi_at } : {}),
    // Sıralama korunsun: fişin ilk eklendiği an
    ...(r.created_at ? { created_at: r.created_at } : {}),
  });
  if (error) {
    if (imagePath) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([imagePath]);
    throw new Error(error.message);
  }
  invalidateFirmCategories();
}

/** Tüm firma adları ve fiş sayıları (yalnızca firma_adi sütunu çekilir). */
export async function getFirmNameCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from(TABLE).select('firma_adi').order('id').range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) {
      const name = String(r.firma_adi ?? '');
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return counts;
}

/** `from` adlarıyla kayıtlı fişlerin firma adını `to` yapar. @returns değişen fiş sayısı */
export async function renameFirms(from: string[], to: string): Promise<number> {
  const names = from.filter((n) => n !== to);
  if (!names.length) return 0;
  // Çift tırnak içeren adlar "in" filtresini bozar; onlar tek tek güncellenir
  const plain = names.filter((n) => !n.includes('"'));
  const quoted = names.filter((n) => n.includes('"'));
  let changed = 0;
  try {
    if (plain.length) {
      const { data, error } = await supabase.from(TABLE).update({ firma_adi: to.trim() }).in('firma_adi', plain).select('id');
      if (error) throw error;
      changed += data?.length ?? 0;
    }
    for (const n of quoted) {
      const { data, error } = await supabase.from(TABLE).update({ firma_adi: to.trim() }).eq('firma_adi', n).select('id');
      if (error) throw error;
      changed += data?.length ?? 0;
    }
  } catch (e) {
    throw new Error(`Firma adları birleştirilemedi: ${errorMessage(e)}`);
  } finally {
    invalidateFirmCategories();
  }
  return changed;
}

/**
 * Fişleri muhasebeciye gönderildi olarak işaretler (`sent` false ise işareti kaldırır).
 * Zaten işaretli olanların tarihi değişmez. @returns değişen fiş sayısı
 */
export async function markReceiptsSent(ids: string[], sent: boolean): Promise<number> {
  const at = sent ? new Date().toISOString() : null;
  let changed = 0;
  for (const part of chunks(ids)) {
    let query = supabase.from(TABLE).update({ muhasebe_gonderildi_at: at }).in('id', part);
    query = sent ? query.is('muhasebe_gonderildi_at', null) : query.not('muhasebe_gonderildi_at', 'is', null);
    const { data, error } = await query.select('id');
    if (error) throw new Error(`İşaretlenemedi: ${error.message}`);
    changed += data?.length ?? 0;
  }
  return changed;
}

/** Seçilen fişlerin kategorisini değiştirir. @returns değişen fiş sayısı */
export async function updateReceiptsCategory(ids: string[], kategori: Kategori): Promise<number> {
  let changed = 0;
  try {
    for (const part of chunks(ids)) {
      const { data, error } = await supabase.from(TABLE).update({ kategori }).in('id', part).select('id');
      if (error) throw new Error(`Kategori değiştirilemedi: ${error.message}`);
      changed += data?.length ?? 0;
    }
  } finally {
    invalidateFirmCategories();
  }
  return changed;
}

/** En son eklenen fişler (eklenme zamanına göre, fiş tarihine göre değil) */
export async function getRecentReceipts(limit = 30): Promise<ReceiptRecord[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false }).order('id').limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(toRecord)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/** Tüm zamanlardaki fiş sayısı (satırları indirmeden). */
export async function countReceipts(): Promise<number> {
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface StorageUsage {
  bytes: number;
  files: number;
}

/** Kullanıcının Storage klasöründeki (arşiv + taslak) fotoğrafların toplam boyutu. */
export async function getStorageUsage(): Promise<StorageUsage> {
  const userId = await currentUserId();
  const usage: StorageUsage = { bytes: 0, files: 0 };
  for (const folder of [userId, `${userId}/drafts`]) {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).list(folder, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      for (const f of data ?? []) {
        if (!f.id) continue; // alt klasör
        usage.files++;
        usage.bytes += Number(f.metadata?.size ?? 0);
      }
      if (!data || data.length < 1000) break;
    }
  }
  return usage;
}

export async function getReceipt(id: string): Promise<ReceiptRecord> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return toRecord(data);
}

/** Kaydedilmiş fişin bilgilerini günceller (görsel değişmez). */
/** Kayıtlı bir fişe fotoğraf ekler ya da fotoğrafını değiştirir (eski dosya silinir). */
export async function attachReceiptImage(record: ReceiptRecord, archiveUri: string): Promise<ReceiptRecord> {
  const userId = await currentUserId();
  const path = await uploadImage(`${userId}/${receiptImageName(record.tarih, record.firma_adi)}.jpg`, archiveUri);
  const { data: row, error } = await supabase.from(TABLE).update({ image_path: path }).eq('id', record.id).select().single();
  if (error) {
    await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([path]);
    throw new Error(`Fotoğraf eklenemedi: ${error.message}`);
  }
  if (record.image_path) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([record.image_path]);
  return toRecord(row);
}

export async function updateReceipt(id: string, data: ReceiptData): Promise<ReceiptRecord> {
  const tarih = trDateToIso(data.tarih);
  if (!tarih) throw new Error('Tarih GG.AA.YYYY biçiminde olmalı.');
  const { data: row, error } = await supabase
    .from(TABLE)
    .update({
      firma_adi: data.firmaAdi.trim(),
      tarih,
      toplam_tutar: round2(data.toplamTutar),
      kdv_yuzde1: round2(data.kdvYuzde1),
      kdv_yuzde10: round2(data.kdvYuzde10),
      kdv_yuzde20: round2(data.kdvYuzde20),
      kategori: data.kategori,
      ...extraColumns(data),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Güncellenemedi: ${error.message}`);
  invalidateFirmCategories();
  return toRecord(row);
}

/** Fişi ve (varsa) Storage'daki görselini siler. */
/**
 * Fişi siler. Çöp kutusu kuruluysa (005) fiş 30 gün geri alınabilir şekilde oraya taşınır ve
 * fotoğrafı saklanır; kurulu değilse fiş ve fotoğrafı kalıcı olarak silinir.
 */
export async function deleteReceipt(receipt: ReceiptRecord): Promise<'trash' | 'deleted'> {
  const trash = await trashReady();
  // Belirsizse (bağlantı hatası) kalıcı silmeye düşülmez
  if (trash === null) throw new Error('Silinemedi: bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.');
  if (trash) {
    // Ekrandaki kopya değil veritabanındaki güncel kayıt saklanır (ör. fotoğraf başka cihazda değiştiyse)
    const { toplam_kdv: _generated, ...row } = await getReceipt(receipt.id);
    // Önceki yarım kalmış bir denemeden kalan kayıt varsa çakışmasın
    await supabase.from(TRASH_TABLE).delete().eq('id', receipt.id);
    const { error: trashError } = await supabase.from(TRASH_TABLE).insert({ id: receipt.id, receipt: row });
    if (trashError) throw new Error(`Silinemedi: ${trashError.message}`);
    const { error } = await supabase.from(TABLE).delete().eq('id', receipt.id);
    if (error) {
      await supabase.from(TRASH_TABLE).delete().eq('id', receipt.id);
      throw new Error(`Silinemedi: ${error.message}`);
    }
    invalidateFirmCategories();
    return 'trash';
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', receipt.id);
  if (error) throw new Error(`Silinemedi: ${error.message}`);
  invalidateFirmCategories();
  if (receipt.image_path) {
    // Görsel silinemese bile kayıt silinmiştir; yalnızca yer kaplar
    await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([receipt.image_path]);
  }
  return 'deleted';
}

export interface TrashItem {
  id: string;
  deleted_at: string;
  receipt: ReceiptRecord;
}

/** Çöp kutusundaki fişler, en son silinen önce */
export async function listTrash(): Promise<TrashItem[]> {
  const { data, error } = await supabase.from(TRASH_TABLE).select('*').order('deleted_at', { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const rec = (r.receipt ?? {}) as Record<string, unknown>;
    const record = toRecord({ ...rec, id: r.id });
    record.toplam_kdv = round2(record.kdv_yuzde1 + record.kdv_yuzde10 + record.kdv_yuzde20);
    return { id: String(r.id), deleted_at: String(r.deleted_at), receipt: record };
  });
}

/** Fişi çöp kutusundan geri alır (aynı kimlik, tarih ve fotoğrafla) */
export async function restoreFromTrash(item: TrashItem): Promise<void> {
  const r = item.receipt;
  const { error } = await supabase.from(TABLE).insert({
    id: r.id,
    created_at: r.created_at,
    firma_adi: r.firma_adi,
    tarih: r.tarih,
    toplam_tutar: r.toplam_tutar,
    kdv_yuzde1: r.kdv_yuzde1,
    kdv_yuzde10: r.kdv_yuzde10,
    kdv_yuzde20: r.kdv_yuzde20,
    kategori: r.kategori,
    image_path: r.image_path,
    ...(r.fis_no ? { fis_no: r.fis_no } : {}),
    ...(r.vkn ? { vkn: r.vkn } : {}),
    ...(r.notlar ? { notlar: r.notlar } : {}),
    ...(r.etiketler.length ? { etiketler: r.etiketler } : {}),
    ...(r.muhasebe_gonderildi_at ? { muhasebe_gonderildi_at: r.muhasebe_gonderildi_at } : {}),
  });
  // 23505: fiş zaten geri alınmış (ör. önceki deneme yarım kaldı) → yalnızca çöp kaydı silinir
  if (error && error.code !== '23505') throw new Error(`Geri alınamadı: ${error.message}`);
  invalidateFirmCategories();
  const { error: trashError } = await supabase.from(TRASH_TABLE).delete().eq('id', item.id);
  if (trashError) throw new Error(`Fiş geri alındı ama Son Silinenler'den kaldırılamadı: ${trashError.message}`);
}

/**
 * Fişleri ve fotoğraflarını kalıcı olarak siler. Fotoğraf yalnızca gerçekten silinen çöp kayıtları için
 * ve hiçbir canlı fiş onu kullanmıyorsa silinir (ör. fiş başka cihazda geri alındıysa fotoğrafı korunur).
 */
export async function purgeTrash(items: TrashItem[]): Promise<void> {
  if (!items.length) return;
  const { data, error } = await supabase
    .from(TRASH_TABLE)
    .delete()
    .in(
      'id',
      items.map((i) => i.id),
    )
    .select('id, receipt');
  if (error) throw new Error(`Silinemedi: ${error.message}`);
  const paths = [
    ...new Set(
      (data ?? [])
        .map((r) => (r.receipt as { image_path?: unknown } | null)?.image_path)
        .filter((p): p is string => typeof p === 'string' && !!p),
    ),
  ];
  if (!paths.length) return;
  const { data: live, error: liveError } = await supabase.from(TABLE).select('image_path').in('image_path', paths);
  // Kontrol edilemezse fotoğraf silinmez (yalnızca yer kaplar; veri kaybı olmasın)
  if (liveError) return;
  const used = new Set((live ?? []).map((r) => String(r.image_path)));
  const orphans = paths.filter((p) => !used.has(p));
  if (orphans.length) await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove(orphans);
}

/** Süresi (30 gün) dolanları kalıcı olarak siler. Açılışta çağrılır; hata fırlatmaz. */
export async function purgeExpiredTrash(): Promise<number> {
  try {
    if ((await trashReady()) !== true) return 0;
    const { data, error } = await supabase.from(TRASH_TABLE).select('id').lt('deleted_at', trashCutoff()).limit(500);
    if (error || !data?.length) return 0;
    const expired = (await listTrash()).filter((i) => data.some((d) => String(d.id) === i.id));
    await purgeTrash(expired);
    return expired.length;
  } catch {
    return 0;
  }
}

