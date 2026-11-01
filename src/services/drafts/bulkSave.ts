import { approveAll, type BulkResult } from '../../lib/bulkApprove';
import type { ReceiptFormValues } from '../../lib/receiptForm';
import type { ReceiptData, ReceiptDraft } from '../../types/receipt';
import { DRAFT_WIDTH, prepareArchiveImage } from '../image/prepareReceiptImages';
import { deleteDraft, downloadDraftImage } from '../supabase/draftsRepository';
import { findPossibleDuplicates, saveReceipt } from '../supabase/receiptsRepository';
import { releaseLocal } from '../supabase/storageFiles';

/**
 * Taslağı fiş olarak kaydeder ve taslağı siler.
 * @returns taslak silinemediyse false (fiş yine de kaydedilmiştir; tekrar kaydedilip çift kayıt oluşmasın)
 */
export async function saveDraftAsReceipt(draft: Pick<ReceiptDraft, 'id' | 'image_path'>, data: ReceiptData): Promise<boolean> {
  const local = await downloadDraftImage(draft.image_path);
  const archiveUri = await prepareArchiveImage(local, DRAFT_WIDTH).finally(() => releaseLocal(local));
  await saveReceipt(data, archiveUri);
  try {
    await deleteDraft(draft);
    return true;
  } catch {
    return false;
  }
}

/** Hazır taslakları toplu onaylar; riskli olanları (hata, mükerrer, belirsiz) incelemeye bırakır. */
export async function approveDrafts(
  items: { draft: ReceiptDraft; values: ReceiptFormValues }[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkResult & { undeleted: number }> {
  const byId = new Map(items.map((i) => [i.draft.id, i.draft]));
  let undeleted = 0;
  const r = await approveAll(
    items.map((i) => ({ id: i.draft.id, values: i.values })),
    {
      isDuplicate: async (data) => (await findPossibleDuplicates(data)).length > 0,
      save: async (id, data) => {
        if (!(await saveDraftAsReceipt(byId.get(id)!, data))) undeleted++;
      },
    },
    onProgress,
  );
  return { ...r, undeleted };
}
