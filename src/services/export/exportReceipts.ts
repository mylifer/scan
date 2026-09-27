import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export { buildReceiptsWorkbook } from './receiptsWorkbook';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ZIP_MIME = 'application/zip';

/** Excel dosyasını paylaşır. */
export function shareXlsx(bytes: Uint8Array, filename: string): Promise<void> {
  return shareFile(bytes, filename, XLSX_MIME, 'org.openxmlformats.spreadsheetml.sheet');
}

/** ZIP dosyasını paylaşır. */
export function shareZip(bytes: Uint8Array, filename: string): Promise<void> {
  return shareFile(bytes, filename, ZIP_MIME, 'public.zip-archive');
}

/** Dosyayı web'de indirir, iPhone'da paylaşım menüsünü açar (Mail, WhatsApp, Dosyalar...). */
async function shareFile(bytes: Uint8Array, filename: string, mimeType: string, uti: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(bytes);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşım kullanılamıyor.');
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: filename });
}

/** "Fisler_2026-09.xlsx" / "Fisler_Tum_Zamanlar.xlsx" (ext: "zip" için paket adı) */
export function exportFilename(range?: { fileTag: string }, ext: 'xlsx' | 'zip' = 'xlsx'): string {
  const base = range ? `Fisler_${range.fileTag}` : 'Fisler_Tum_Zamanlar';
  return ext === 'zip' ? `${base.replace('Fisler', 'Muhasebe_Paketi')}.zip` : `${base}.xlsx`;
}
