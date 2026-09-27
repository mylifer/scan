import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export { buildReceiptsWorkbook } from './receiptsWorkbook';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Dosyayı web'de indirir, iPhone'da paylaşım menüsünü açar (Mail, WhatsApp, Dosyalar...). */
export async function shareXlsx(bytes: Uint8Array, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: XLSX_MIME }));
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
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
    dialogTitle: filename,
  });
}

/** "Fisler_2026-09.xlsx" / "Fisler_Tum_Zamanlar.xlsx" */
export function exportFilename(range?: { from: string }): string {
  return range ? `Fisler_${range.from.slice(0, 7)}.xlsx` : 'Fisler_Tum_Zamanlar.xlsx';
}
