import { markReceiptsSent } from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';
import { showActionSheet } from './actionSheet';

/**
 * Seçilen fişler için "muhasebeciye gönderildi" menüsü (ana sayfa ve Tüm Fişler ortak).
 * `run`, işlemi yürütüp sonuç mesajını gösteren çağıranın sarmalayıcısıdır.
 */
export function showSentSheet(list: Pick<ReceiptRecord, 'id' | 'muhasebe_gonderildi_at'>[], run: (task: () => Promise<string>) => void) {
  if (!list.length) return;
  const ids = list.map((r) => r.id);
  const unsent = list.filter((r) => !r.muhasebe_gonderildi_at).length;
  const sent = list.length - unsent;
  showActionSheet({
    title: `${list.length} fiş`,
    message: sent && unsent ? `${sent} tanesi zaten gönderildi olarak işaretli.` : undefined,
    options: [
      ...(unsent ? [{ label: `Muhasebeciye Gönderildi (${unsent})`, onPress: () => run(async () => `${await markReceiptsSent(ids, true)} fiş gönderildi olarak işaretlendi`) }] : []),
      ...(sent ? [{ label: `Gönderildi İşaretini Kaldır (${sent})`, onPress: () => run(async () => `${await markReceiptsSent(ids, false)} fişin işareti kaldırıldı`) }] : []),
    ],
  });
}
