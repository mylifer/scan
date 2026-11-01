import { fromFormValues, type ReceiptFormValues, validateForm } from './receiptForm';
import type { ReceiptData } from '../types/receipt';

/** Toplu onayda bir fiş: taslak kimliği + formdaki (düzenlenmiş olabilir) değerler */
export interface BulkItem {
  id: string;
  values: ReceiptFormValues;
}

export type BulkSkipReason = 'hata' | 'mukerrer' | 'belirsiz' | 'kaydedilemedi';

export interface BulkResult {
  saved: string[];
  /** Kaydedilmeyip incelemeye bırakılanlar (sebebiyle) */
  skipped: { id: string; reason: BulkSkipReason; message?: string }[];
}

export interface BulkDeps {
  /** Aynı tarih ve tutarla kayıtlı fiş var mı */
  isDuplicate: (data: ReceiptData) => Promise<boolean>;
  /** Fişi kaydeder ve taslağı siler */
  save: (id: string, data: ReceiptData) => Promise<void>;
}

/**
 * Taslakları sırayla kaydeder. Riskli olanlar kaydedilmez, incelemeye bırakılır:
 * form hatası, olası mükerrer kayıt, yapay zekânın emin olamadığı alan.
 */
export async function approveAll(
  items: BulkItem[],
  deps: BulkDeps,
  onProgress?: (done: number, total: number) => void,
): Promise<BulkResult> {
  const result: BulkResult = { saved: [], skipped: [] };
  for (let i = 0; i < items.length; i++) {
    const { id, values } = items[i]!;
    try {
      if (validateForm(values).length) {
        result.skipped.push({ id, reason: 'hata' });
        continue;
      }
      if (values.belirsiz?.length) {
        result.skipped.push({ id, reason: 'belirsiz' });
        continue;
      }
      const data = fromFormValues(values);
      if (await deps.isDuplicate(data)) {
        result.skipped.push({ id, reason: 'mukerrer' });
        continue;
      }
      await deps.save(id, data);
      result.saved.push(id);
    } catch (e) {
      result.skipped.push({ id, reason: 'kaydedilemedi', message: e instanceof Error ? e.message : String(e) });
    } finally {
      onProgress?.(i + 1, items.length);
    }
  }
  return result;
}

/** Kullanıcıya gösterilecek özet: "8 fiş kaydedildi. 2 fiş kontrol bekliyor (1 olası mükerrer, 1 eksik bilgi)." */
export function bulkSummary(r: BulkResult): string {
  const parts = [`${r.saved.length} fiş kaydedildi.`];
  if (r.skipped.length) {
    const count = (k: BulkSkipReason) => r.skipped.filter((s) => s.reason === k).length;
    const detail = [
      count('mukerrer') && `${count('mukerrer')} olası mükerrer`,
      count('hata') && `${count('hata')} eksik/hatalı bilgi`,
      count('belirsiz') && `${count('belirsiz')} emin olunamayan alan`,
      count('kaydedilemedi') && `${count('kaydedilemedi')} kaydedilemedi`,
    ].filter(Boolean);
    parts.push(`${r.skipped.length} fiş kontrol bekliyor (${detail.join(', ')}).`);
  }
  return parts.join(' ');
}
