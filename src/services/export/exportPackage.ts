import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';

import { downloadBytes } from '../supabase/storageFiles';
import type { PeriodSummary } from '../supabase/receiptsRepository';
import { photoFileNames } from './packageNames';
import { buildReceiptsWorkbook } from './receiptsWorkbook';

export interface PackageResult {
  photos: number;
  /** İndirilemeyen fotoğraf sayısı (paket yine de oluşturulur) */
  failed: number;
}

/** ZIP çıktısının parça parça yazıldığı yer (dosya ya da bellek) */
export type ChunkSink = (chunk: Uint8Array) => void;

/**
 * Muhasebe paketi: Excel + dönemin fiş fotoğrafları tek ZIP'te.
 * Akış (streaming) olarak üretilir: her fotoğraf indirilir indirilmez ZIP'e yazılıp bellekten bırakılır,
 * böylece binlerce fotoğraflı yıllık paket bile belleğe iki kez sığdırılmak zorunda kalmaz.
 * Fotoğraflar zaten sıkıştırılmış JPEG olduğundan ZIP içinde yeniden sıkıştırılmaz.
 */
export async function buildAccountingPackage(
  summary: PeriodSummary,
  periodLabel: string,
  excelName: string,
  sink: ChunkSink,
  onProgress?: (done: number, total: number) => void,
): Promise<PackageResult> {
  let zipError: Error | null = null;
  /** İlk hatada diğer indirme işçileri de dursun (yarım dosyaya yazmaya devam etmesinler) */
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

  add(excelName, buildReceiptsWorkbook(summary, periodLabel), true);

  const withPhoto = summary.fisler.filter((r) => r.image_path);
  const names = photoFileNames(withPhoto);
  let failed = 0;
  // Aynı anda en fazla 4 indirme (hız ve bellek dengesi); ZIP'e ekleme sırayla (tek iş parçacığı)
  let next = 0;
  let done = 0;
  onProgress?.(0, withPhoto.length);
  async function worker() {
    while (!aborted && next < withPhoto.length) {
      const r = withPhoto[next++];
      let bytes: Uint8Array | null = null;
      try {
        bytes = await downloadBytes(r.image_path!);
      } catch {
        failed++;
      }
      if (aborted) return;
      if (bytes) add(`Fotograflar/${names.get(r.id)}`, bytes, false);
      onProgress?.(++done, withPhoto.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, withPhoto.length) }, worker));
  zip.end();
  if (zipError) throw zipError;
  return { photos: withPhoto.length - failed, failed };
}
