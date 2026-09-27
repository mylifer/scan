import type { ReceiptData, ReceiptDraft } from '../../types/receipt';
import { supabase } from './client';
import { currentUserId, RECEIPT_IMAGES_BUCKET, uniqueName, uploadImage } from './receiptsRepository';
import { downloadToLocal } from './storageFiles';

const TABLE = 'receipt_drafts';

/** receipt_drafts tablosu henüz oluşturulmadıysa (002 migration çalıştırılmadıysa) fırlatılır. */
export class DraftsNotSetUpError extends Error {
  constructor() {
    super('Toplu tarama için veritabanı kurulumu gerekli (002_receipt_drafts.sql).');
    this.name = 'DraftsNotSetUpError';
  }
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  // 42P01: tablo yok · PGRST205: şema önbelleğinde tablo yok
  if (error.code === '42P01' || error.code === 'PGRST205') throw new DraftsNotSetUpError();
  throw new Error(error.message);
}

export async function listDrafts(): Promise<ReceiptDraft[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: true });
  check(error);
  return (data ?? []) as ReceiptDraft[];
}

/** Hazırlanmış (küçültülmüş) yerel görseli yükler ve taslak kaydı oluşturur. */
export async function addDraft(localUri: string): Promise<ReceiptDraft> {
  const userId = await currentUserId();
  const path = await uploadImage(`${userId}/drafts/${uniqueName()}.jpg`, localUri);
  const { data, error } = await supabase.from(TABLE).insert({ image_path: path }).select().single();
  if (error) {
    await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([path]);
    check(error);
  }
  return data as ReceiptDraft;
}

export async function updateDraft(
  id: string,
  patch: Partial<Pick<ReceiptDraft, 'status' | 'scheduled_for' | 'error'>> & { result?: ReceiptData | null },
): Promise<void> {
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
  check(error);
}

export async function scheduleDrafts(ids: string[], at: Date | null): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase
    .from(TABLE)
    .update(at ? { status: 'scheduled', scheduled_for: at.toISOString() } : { status: 'pending', scheduled_for: null })
    .in('id', ids);
  check(error);
}

export async function deleteDraft(draft: Pick<ReceiptDraft, 'id' | 'image_path'>): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', draft.id);
  check(error);
  await supabase.storage.from(RECEIPT_IMAGES_BUCKET).remove([draft.image_path]);
}

/** Taslak görsellerini ekranda göstermek için geçici (1 saatlik) bağlantılar. */
export async function draftImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).createSignedUrls(paths, 3600);
  const map: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  return map;
}

/** Taslak görselini indirip yerel bir URI döner (web: blob URL, iPhone: önbellek dosyası). */
export function downloadDraftImage(path: string): Promise<string> {
  return downloadToLocal(path);
}
