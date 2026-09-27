import { zipSync, type Zippable } from 'fflate';

import { downloadBytes } from '../supabase/storageFiles';
import type { PeriodSummary } from '../supabase/receiptsRepository';
import { photoFileNames } from './packageNames';
import { buildReceiptsWorkbook } from './receiptsWorkbook';

export interface PackageResult {
  bytes: Uint8Array;
  photos: number;
  /** İndirilemeyen fotoğraf sayısı (paket yine de oluşturulur) */
  failed: number;
}

/**
 * Muhasebe paketi: Excel + dönemin fiş fotoğrafları tek ZIP'te.
 * Fotoğraflar zaten sıkıştırılmış JPEG olduğundan ZIP içinde yeniden sıkıştırılmaz.
 */
export async function buildAccountingPackage(
  summary: PeriodSummary,
  periodLabel: string,
  excelName: string,
  onProgress?: (done: number, total: number) => void,
): Promise<PackageResult> {
  const withPhoto = summary.fisler.filter((r) => r.image_path);
  const names = photoFileNames(withPhoto);
  const files: Zippable = {
    [excelName]: [buildReceiptsWorkbook(summary, periodLabel), { level: 6 }],
  };
  let failed = 0;
  // Aynı anda en fazla 4 indirme (hız ve bellek dengesi)
  let next = 0;
  let done = 0;
  onProgress?.(0, withPhoto.length);
  async function worker() {
    while (next < withPhoto.length) {
      const r = withPhoto[next++];
      try {
        files[`Fotograflar/${names.get(r.id)}`] = [await downloadBytes(r.image_path!), { level: 0 }];
      } catch {
        failed++;
      }
      onProgress?.(++done, withPhoto.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, withPhoto.length) }, worker));
  return { bytes: zipSync(files), photos: withPhoto.length - failed, failed };
}
