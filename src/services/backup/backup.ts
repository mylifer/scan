import { strFromU8, strToU8, unzipSync, Zip, ZipDeflate, ZipPassThrough } from 'fflate';

import {
  type BackupReceipt,
  buildManifest,
  MANIFEST_NAME,
  parseManifest,
  photoEntryName,
  planRestore,
} from '../../lib/backupFormat';
import { APP_VERSION } from '../../lib/version';
import type { ChunkSink } from '../export/exportPackage';
import { categoriesReady } from '../supabase/schema';
import { downloadBytes } from '../supabase/storageFiles';
import { currentUserId, getSummary, insertRestoredReceipt } from '../supabase/receiptsRepository';
import { ESKI_KATEGORILER } from '../../types/receipt';

export interface BackupResult {
  receipts: number;
  photos: number;
  /** İndirilemeyen fotoğraf sayısı (yedek yine oluşturulur, bu fişler fotoğrafsız yedeklenir) */
  failedPhotos: number;
}

/**
 * Tüm fişler + fotoğraflar tek ZIP'e, akış olarak (fotoğraf indirilir indirilmez yazılır).
 * yedek.json en sona yazılır: hangi fotoğrafların gerçekten yedeklendiği o zaman bellidir.
 */
export async function createBackup(sink: ChunkSink, onProgress?: (done: number, total: number) => void): Promise<BackupResult> {
  const { fisler } = await getSummary();
  let zipError: Error | null = null;
  let aborted = false;
  const zip = new Zip((err, chunk) => {
    if (err) zipError = err;
    else sink(chunk);
  });
  const add = (name: string, data: Uint8Array, compress: boolean) => {
    try {
      const entry = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
      zip.add(entry);
      entry.push(data, true);
      if (zipError) throw zipError;
    } catch (e) {
      aborted = true;
      throw e;
    }
  };

  const withPhoto = fisler.filter((r) => r.image_path);
  const saved = new Set<string>();
  let next = 0;
  let done = 0;
  onProgress?.(0, withPhoto.length);
  async function worker() {
    while (!aborted && next < withPhoto.length) {
      const r = withPhoto[next++]!;
      let bytes: Uint8Array | null = null;
      try {
        bytes = await downloadBytes(r.image_path!);
      } catch {
        // fotoğrafsız yedeklenir
      }
      if (aborted) return;
      if (bytes) {
        add(photoEntryName(r.id), bytes, false);
        saved.add(r.id);
      }
      onProgress?.(++done, withPhoto.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, withPhoto.length) }, worker));
  add(MANIFEST_NAME, strToU8(JSON.stringify(buildManifest(fisler, saved, new Date().toISOString(), APP_VERSION))), true);
  zip.end();
  if (zipError) throw zipError;
  return { receipts: fisler.length, photos: saved.size, failedPhotos: withPhoto.length - saved.size };
}

export interface RestorePreview {
  total: number;
  toInsert: BackupReceipt[];
  skipped: number;
  createdAt: string;
  /** ZIP içeriği (fotoğraflar); geri yüklemede kullanılır */
  files: Record<string, Uint8Array>;
}

/** Yedek dosyasını açar, doğrular ve hesapta zaten olan fişleri ayıklar (henüz hiçbir şey yazmaz). */
export async function previewRestore(bytes: Uint8Array): Promise<RestorePreview> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('Dosya açılamadı. Uygulamadan alınmış bir yedek (.zip) seçin.');
  }
  const manifest = files[MANIFEST_NAME];
  if (!manifest) throw new Error('Bu dosya bu uygulamanın yedeği değil (yedek.json yok).');
  const { receipts, createdAt } = parseManifest(strFromU8(manifest));
  const { fisler } = await getSummary();
  const plan = planRestore(receipts, fisler);
  return { total: receipts.length, toInsert: plan.toInsert, skipped: plan.skipped, createdAt, files };
}

export interface RestoreResult {
  inserted: number;
  failed: number;
  photoFailed: number;
}

export async function applyRestore(preview: RestorePreview, onProgress?: (done: number, total: number) => void): Promise<RestoreResult> {
  // Yeni kategoriler veritabanında etkinleşmeden bu kategorilerdeki fişler kaydedilemez
  if (preview.toInsert.some((r) => !ESKI_KATEGORILER.includes(r.kategori)) && (await categoriesReady()) === false) {
    throw new Error('Yedekte yeni kategorilerde fişler var. Önce ana sayfadaki "Yeni kategorileri etkinleştir" adımını tamamlayın.');
  }
  const userId = await currentUserId();
  const result: RestoreResult = { inserted: 0, failed: 0, photoFailed: 0 };
  const total = preview.toInsert.length;
  onProgress?.(0, total);
  // Sırayla: Supabase'i yormadan, ilerleme doğru görünsün
  for (const [i, r] of preview.toInsert.entries()) {
    try {
      const photo = r.photo ? (preview.files[r.photo] ?? null) : null;
      const { photoFailed } = await insertRestoredReceipt(userId, r, photo);
      result.inserted++;
      if (photoFailed || (r.photo && !photo)) result.photoFailed++;
    } catch {
      result.failed++;
    }
    onProgress?.(i + 1, total);
  }
  return result;
}
