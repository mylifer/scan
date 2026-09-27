import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { supabase } from './client';
import { RECEIPT_IMAGES_BUCKET, uniqueName } from './receiptsRepository';

/**
 * Storage'daki bir görseli cihaza indirir ve yerel URI döner.
 * Web: blob URL. iPhone: önbellek dosyası (React Native'in Blob'u arrayBuffer
 * desteklemediği için dosya olarak indirilir).
 */
export async function downloadToLocal(path: string): Promise<string> {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).download(path);
    if (error || !data) throw new Error(`Görsel indirilemedi: ${error?.message ?? ''}`);
    return URL.createObjectURL(data);
  }
  const { data, error } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error(`Görsel indirilemedi: ${error?.message ?? ''}`);
  const file = await File.downloadFileAsync(data.signedUrl, new File(Paths.cache, `dl-${uniqueName()}.jpg`), { idempotent: true });
  return file.uri;
}

/** Storage'daki bir dosyanın baytları (ZIP paketlemek için). */
export async function downloadBytes(path: string): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const { data, error } = await supabase.storage.from(RECEIPT_IMAGES_BUCKET).download(path);
    if (error || !data) throw new Error(`Görsel indirilemedi: ${error?.message ?? ''}`);
    return new Uint8Array(await data.arrayBuffer());
  }
  const uri = await downloadToLocal(path);
  const file = new File(uri);
  try {
    return new Uint8Array(await file.arrayBuffer());
  } finally {
    file.delete();
  }
}
