import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

import { receiptImageName } from '../../lib/format';
import { receiptShareText } from '../../lib/receiptText';
import type { ReceiptRecord } from '../../types/receipt';
import { downloadBytes, downloadToLocal, releaseLocal } from '../supabase/storageFiles';

/**
 * Tek bir fişi fotoğrafı ve bilgileriyle paylaşım menüsüne gönderir (WhatsApp, Mail…).
 * @returns 'copied' paylaşım menüsü olmayan tarayıcılarda metin panoya kopyalandıysa
 */
export async function shareReceipt(r: ReceiptRecord): Promise<'shared' | 'copied'> {
  const text = receiptShareText(r);

  if (Platform.OS !== 'web') {
    const url = r.image_path ? await downloadToLocal(r.image_path) : undefined;
    try {
      // iOS: fotoğraf ve metin birlikte paylaşılır; Share.share paylaşım sayfası kapanınca döner
      await Share.share(url ? { url, message: text } : { message: text });
    } finally {
      if (url) releaseLocal(url);
    }
    return 'shared';
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    let data: ShareData = { text };
    if (r.image_path) {
      const bytes = await downloadBytes(r.image_path);
      const file = new globalThis.File([bytes as BlobPart], `${receiptImageName(r.tarih, r.firma_adi)}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) data = { text, files: [file] };
    }
    try {
      await navigator.share(data);
    } catch (e) {
      // Kullanıcı paylaşım menüsünü kapattı
      if (e instanceof Error && e.name === 'AbortError') return 'shared';
      throw e;
    }
    return 'shared';
  }

  await Clipboard.setStringAsync(text);
  return 'copied';
}
