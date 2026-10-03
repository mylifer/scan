import { File } from 'expo-file-system';

/**
 * Yedek dosyasını seçtirir (iPhone: Dosyalar / iCloud Drive) ve baytlarını döner.
 * Vazgeçilirse null. Seçilen dosyaya dokunulmaz (yalnızca okunur).
 */
export async function pickBackupFile(): Promise<Uint8Array | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/zip', 'application/x-zip-compressed', 'public.zip-archive'] });
  if (picked.canceled) return null;
  return new Uint8Array(await picked.result.arrayBuffer());
}
