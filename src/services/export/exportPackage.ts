import { downloadBytes } from '../supabase/storageFiles';
import type { PeriodSummary } from '../supabase/receiptsRepository';
import { buildAccountingPackageWith, type ChunkSink, type PackageResult } from './accountingPackage';

export type { ChunkSink, PackageResult } from './accountingPackage';

/**
 * Muhasebe paketi: Excel + dönemin fiş fotoğrafları tek ZIP'te (bkz. accountingPackage).
 * Fotoğraflar bu platformun Storage indiricisiyle alınır.
 */
export function buildAccountingPackage(
  summary: PeriodSummary,
  periodLabel: string,
  excelName: string,
  sink: ChunkSink,
  onProgress?: (done: number, total: number) => void,
): Promise<PackageResult> {
  return buildAccountingPackageWith(downloadBytes, summary, periodLabel, excelName, sink, onProgress);
}
