import { findPossibleDuplicates } from '../services/supabase/receiptsRepository';
import type { ReceiptData } from '../types/receipt';
import { showActionSheet } from './actionSheet';
import { formatTL, isoToTrDate } from './format';

/**
 * Aynı tarih ve tutarda bir fiş varsa kullanıcıya sorar.
 * @returns kaydetmeye devam edilecekse true
 */
export async function confirmIfDuplicate(data: ReceiptData, excludeId?: string): Promise<boolean> {
  const dups = await findPossibleDuplicates(data, excludeId);
  if (!dups.length) return true;
  const d = dups[0];
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v: boolean) => {
      if (answered) return;
      answered = true;
      resolve(v);
    };
    showActionSheet({
      title: 'Bu fiş zaten kayıtlı olabilir',
      message: `${d.firma_adi} · ${isoToTrDate(d.tarih)} · ${formatTL(d.toplam_tutar)}${dups.length > 1 ? ` ve ${dups.length - 1} fiş daha` : ''} aynı tarih ve tutarla kayıtlı.`,
      options: [{ label: 'Yine de Kaydet', onPress: () => answer(true) }],
      onCancel: () => answer(false),
    });
  });
}
