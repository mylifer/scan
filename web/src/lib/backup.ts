import { strFromU8, strToU8, unzipSync, Zip, ZipDeflate, ZipPassThrough } from "fflate";
import {
  type BackupManifest,
  type BackupReceipt,
  buildManifest,
  MANIFEST_NAME,
  parseManifest,
  photoEntryName,
  planRestore,
} from "@shared/lib/backupFormat";
import { receiptImageName, round2 } from "@shared/lib/format";
import { downloadFile } from "./download";
import { listReceipts } from "./receipts";
import { supabase } from "./supabase";

const BUCKET = "receipt-images";
const RECEIPTS_TABLE = "receipts";

export interface BackupExportProgress {
  done: number;
  total: number;
  status: string;
}

/** Tüm fişleri ve fotoğraflarını .zip olarak indirir */
export async function exportFullBackup(
  onProgress?: (progress: BackupExportProgress) => void
): Promise<{ receiptsCount: number; photosCount: number }> {
  onProgress?.({ done: 0, total: 1, status: "Fiş kayıtları alınıyor…" });

  const receipts = await listReceipts();
  const withPhoto = receipts.filter((r) => r.image_path);
  const totalPhotos = withPhoto.length;

  const chunks: Uint8Array[] = [];
  let zipError: Error | null = null;

  const zip = new Zip((err, chunk, final) => {
    if (err) zipError = err;
    else {
      chunks.push(chunk);
      if (final && !zipError) {
        const today = new Date().toISOString().slice(0, 10);
        downloadFile(chunks as unknown as BlobPart[], `fis-tarayici-yedek-${today}.zip`, "application/zip");
      }
    }
  });

  const add = (name: string, data: Uint8Array, compress: boolean) => {
    const entry = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
    zip.add(entry);
    entry.push(data, true);
  };

  const saved = new Set<string>();

  for (let i = 0; i < totalPhotos; i++) {
    const r = withPhoto[i];
    onProgress?.({
      done: i + 1,
      total: totalPhotos,
      status: `Fotoğraflar paketleniyor (${i + 1}/${totalPhotos})…`,
    });

    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(r.image_path!);
      if (!error && data) {
        const buffer = await data.arrayBuffer();
        add(photoEntryName(r.id), new Uint8Array(buffer), false);
        saved.add(r.id);
      }
    } catch {
      // Fotoğraf indirilemezse sessizce geçilir, fiş fotoğrafsız yedeklenir
    }
  }

  onProgress?.({ done: totalPhotos, total: totalPhotos, status: "Yedek manifesti oluşturuluyor…" });

  const manifest = buildManifest(receipts, saved, new Date().toISOString(), "Web 0.5.0");
  add(MANIFEST_NAME, strToU8(JSON.stringify(manifest, null, 2)), true);

  zip.end();

  if (zipError) {
    throw zipError;
  }

  return { receiptsCount: receipts.length, photosCount: saved.size };
}

export interface RestorePlanPreview {
  total: number;
  toInsert: BackupReceipt[];
  skipped: number;
  createdAt: string;
  manifest: BackupManifest;
  zipBytes: Uint8Array;
}

/** Seçilen ZIP yedek dosyasını inceler ve eklenecek/atlanacak kayıtları planlar */
export async function previewRestoreZip(file: File): Promise<RestorePlanPreview> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(bytes, { filter: (f) => f.name === MANIFEST_NAME });
  } catch {
    throw new Error("Yedek dosyası açılamadı. Geçerli bir .zip dosyası seçtiğinizden emin olun.");
  }

  const manifestBytes = unzipped[MANIFEST_NAME];
  if (!manifestBytes) {
    throw new Error("Bu dosya geçerli bir fiş yedeği değil (yedek.json bulunamadı).");
  }

  const manifest = parseManifest(strFromU8(manifestBytes));
  const currentReceipts = await listReceipts();
  const plan = planRestore(manifest.receipts, currentReceipts);

  return {
    total: manifest.receipts.length,
    toInsert: plan.toInsert,
    skipped: plan.skipped,
    createdAt: manifest.createdAt,
    manifest,
    zipBytes: bytes,
  };
}

export interface RestoreProgress {
  done: number;
  total: number;
  status: string;
}

/** Planlanan fişleri ve fotoğraflarını veritabanına aktarır */
export async function executeRestore(
  preview: RestorePlanPreview,
  onProgress?: (p: RestoreProgress) => void
): Promise<{ inserted: number; failed: number }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id ?? "";

  const total = preview.toInsert.length;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const r = preview.toInsert[i];
    onProgress?.({
      done: i + 1,
      total,
      status: `Fişler aktarılıyor (${i + 1}/${total}): ${r.firma_adi}…`,
    });

    let imagePath: string | null = null;

    if (r.photo) {
      try {
        const photoFiles = unzipSync(preview.zipBytes, { filter: (f) => f.name === r.photo });
        const photoBytes = photoFiles[r.photo];
        if (photoBytes) {
          const path = `${userId}/${receiptImageName(r.tarih, r.firma_adi)}.jpg`;
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, photoBytes, {
            contentType: "image/jpeg",
            upsert: false,
          });
          if (!upErr) {
            imagePath = path;
          }
        }
      } catch {
        // Fotoğraf yüklenemezse fiş fotoğrafsız eklenir
      }
    }

    const { error: insErr } = await supabase.from(RECEIPTS_TABLE).insert({
      firma_adi: r.firma_adi,
      tarih: r.tarih,
      toplam_tutar: round2(r.toplam_tutar),
      kdv_yuzde1: round2(r.kdv_yuzde1),
      kdv_yuzde10: round2(r.kdv_yuzde10),
      kdv_yuzde20: round2(r.kdv_yuzde20),
      kategori: r.kategori,
      image_path: imagePath,
      ...(r.fis_no ? { fis_no: r.fis_no } : {}),
      ...(r.vkn ? { vkn: r.vkn } : {}),
      ...(r.notlar ? { notlar: r.notlar } : {}),
      ...(r.etiketler?.length ? { etiketler: r.etiketler } : {}),
      ...(r.muhasebe_gonderildi_at ? { muhasebe_gonderildi_at: r.muhasebe_gonderildi_at } : {}),
      ...(r.created_at ? { created_at: r.created_at } : {}),
    });

    if (insErr) {
      failed++;
    } else {
      inserted++;
    }
  }

  return { inserted, failed };
}
