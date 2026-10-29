import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { hasNativeModule } from '../nativeModules';

/** Sunucu fonksiyonunun kabul ettiği en büyük PDF (base64 ~6,7 MB) */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export interface PickedPdf {
  name: string;
  /** base64, data: öneki olmadan */
  base64: string;
}

/** Belge seçici bu kurulumda var mı (web'de her zaman; telefonda yeni derlemede ve Expo Go'da) */
export const pdfPickerAvailable = () => Platform.OS === 'web' || hasNativeModule('ExpoDocumentPicker');

/** Dosyalar'dan (iCloud, mail eki kaydedilen yer…) bir PDF seçtirir. Vazgeçilirse null. */
export async function pickInvoicePdf(): Promise<PickedPdf | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, base64: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > MAX_PDF_BYTES) throw new Error('PDF çok büyük (en fazla 5 MB). Faturanın kendisini seçtiğinizden emin olun.');
  const isPdf = (asset.mimeType ?? '').includes('pdf') || /\.pdf$/i.test(asset.name);
  if (!isPdf) throw new Error('Lütfen bir PDF dosyası seçin.');
  let base64 = Platform.OS === 'web' ? (asset.base64 ?? '') : await new File(asset.uri).base64();
  base64 = base64.replace(/^data:[^,]*,/, '');
  if (!base64) throw new Error('PDF okunamadı.');
  if (base64.length > (MAX_PDF_BYTES * 4) / 3 + 4) throw new Error('PDF çok büyük (en fazla 5 MB).');
  return { name: asset.name, base64 };
}
