import { approveAll, type BulkResult } from '../../lib/bulkApprove';
import type { ReceiptFormValues } from '../../lib/receiptForm';
import type { ReceiptData, ReceiptDraft } from '../../types/receipt';
import { DRAFT_WIDTH, prepareArchiveImage } from '../image/prepareReceiptImages';
import { deleteDraft, downloadDraftImage } from '../supabase/draftsRepository';
import { findPossibleDuplicates, saveReceipt } from '../supabase/receiptsRepository';
import { releaseLocal } from '../supabase/storageFiles';

/**
 * Kaydın sonucu. `silinemedi`: fiş kaydedildi ama taslak silinemedi. `gorselsiz`: fiş kaydedildi ama görseli
 * yüklenemedi; fotoğrafın tek kopyası taslakta olduğundan taslak silinmez. İki durumda da fiş kayıtlıdır,
 * tekrar kaydedilip çift kayıt oluşmasın (tekrar onaylanırsa olası mükerrer olarak yakalanır).
 */
export type DraftSaveResult = 'tamam' | 'silinemedi' | 'gorselsiz';

/** Taslağı fiş olarak kaydeder ve (görseli de yüklendiyse) taslağı siler. */
export async function saveDraftAsReceipt(draft: Pick<ReceiptDraft, 'id' | 'image_path'>, data: ReceiptData): Promise<DraftSaveResult> {
  const local = await downloadDraftImage(draft.image_path);
  const archiveUri = await prepareArchiveImage(local, DRAFT_WIDTH).finally(() => releaseLocal(local));
  const { imageWarning } = await saveReceipt(data, archiveUri);
  if (imageWarning) return 'gorselsiz';
  try {
    await deleteDraft(draft);
    return 'tamam';
  } catch {
    return 'silinemedi';
  }
}

/** Hazır taslakları toplu onaylar; riskli olanları (hata, mükerrer, belirsiz) incelemeye bırakır. */
export async function approveDrafts(
  items: { draft: ReceiptDraft; values: ReceiptFormValues }[],
  onProgress?: (done: number, total: number) => void,
): Promise<BulkResult & { undeleted: number; imageMissing: number }> {
  const byId = new Map(items.map((i) => [i.draft.id, i.draft]));
  let undeleted = 0;
  let imageMissing = 0;
  const r = await approveAll(
    items.map((i) => ({ id: i.draft.id, values: i.values })),
    {
      isDuplicate: async (data) => (await findPossibleDuplicates(data)).length > 0,
      save: async (id, data) => {
        const sonuc = await saveDraftAsReceipt(byId.get(id)!, data);
        if (sonuc === 'silinemedi') undeleted++;
        else if (sonuc === 'gorselsiz') imageMissing++;
      },
    },
    onProgress,
  );
  return { ...r, undeleted, imageMissing };
}

/** Görseli yüklenemeyen fişler için kullanıcıya gösterilecek uyarı */
export function imageMissingMessage(n: number): string {
  return `${n} fiş görselsiz kaydedildi; fotoğraf kaybolmasın diye taslağı silinmedi. Tekrar kaydetmeyin, Toplu Tarama ekranından silebilirsiniz.`;
}
