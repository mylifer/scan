import { File, FileMode, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export { buildReceiptsWorkbook, writeReceiptsWorkbookWithPhotos } from './receiptsWorkbook';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ZIP_MIME = 'application/zip';

/** Excel dosyasını paylaşır. */
export function shareXlsx(bytes: Uint8Array, filename: string): Promise<void> {
  return shareFile(bytes, filename, XLSX_MIME, 'org.openxmlformats.spreadsheetml.sheet');
}

/**
 * ZIP'i parça parça üretip paylaşır: iPhone'da parçalar doğrudan önbellekteki dosyaya eklenir,
 * web'de tek bir büyük diziye birleştirilmeden Blob'a verilir (bellekte ikinci kopya oluşmaz).
 */
export function shareZipStream<R>(filename: string, build: (sink: (chunk: Uint8Array) => void) => Promise<R>): Promise<R> {
  return shareStream(filename, ZIP_MIME, 'public.zip-archive', build);
}

/** Fotoğraflı Excel gibi büyük .xlsx dosyalarını parça parça üretip paylaşır (bkz. shareZipStream). */
export function shareXlsxStream<R>(filename: string, build: (sink: (chunk: Uint8Array) => void) => Promise<R>): Promise<R> {
  return shareStream(filename, XLSX_MIME, 'org.openxmlformats.spreadsheetml.sheet', build);
}

async function shareStream<R>(filename: string, mimeType: string, uti: string, build: (sink: (chunk: Uint8Array) => void) => Promise<R>): Promise<R> {
  if (Platform.OS === 'web') {
    const chunks: Uint8Array[] = [];
    const result = await build((c) => chunks.push(c));
    downloadBlob(new Blob(chunks as BlobPart[], { type: mimeType }), filename);
    return result;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  // Tek bir dosya tanıtıcısı: her parçada dosyayı yeniden açmaz; yazma hatası (ör. disk dolu)
  // yakalanabilir bir hata olarak döner (write(append) iOS'ta yakalanamayan istisna atabiliyor)
  const handle = file.open(FileMode.WriteOnly);
  let result: R;
  try {
    result = await build((c) => handle.writeBytes(c));
  } catch (e) {
    handle.close();
    if (file.exists) file.delete();
    throw e;
  }
  handle.close();
  await shareCachedFile(file, filename, mimeType, uti);
  return result;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function shareCachedFile(file: File, filename: string, mimeType: string, uti: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşım kullanılamıyor.');
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: filename });
}

/** Dosyayı web'de indirir, iPhone'da paylaşım menüsünü açar (Mail, WhatsApp, Dosyalar...). */
async function shareFile(bytes: Uint8Array, filename: string, mimeType: string, uti: string): Promise<void> {
  if (Platform.OS === 'web') {
    downloadBlob(new Blob([bytes as BlobPart], { type: mimeType }), filename);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(bytes);
  await shareCachedFile(file, filename, mimeType, uti);
}

/** "Fisler_2026-09.xlsx" / "Fisler_Tum_Zamanlar.xlsx" (ext: "zip" için paket adı) */
export function exportFilename(range?: { fileTag: string }, ext: 'xlsx' | 'zip' = 'xlsx'): string {
  const base = range ? `Fisler_${range.fileTag}` : 'Fisler_Tum_Zamanlar';
  return ext === 'zip' ? `${base.replace('Fisler', 'Muhasebe_Paketi')}.zip` : `${base}.xlsx`;
}
