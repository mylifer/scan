import { round2 } from './format';
import { type Kategori, KATEGORILER, type ReceiptRecord } from '../types/receipt';

/**
 * Tam yedek dosyası biçimi (ZIP):
 *   yedek.json            → BackupManifest
 *   fotograflar/<id>.jpg  → fiş fotoğrafları
 * Geri yükleme saf fonksiyonlarla planlanır: aynı fiş (firma + tarih + tutar) hesapta zaten
 * kaç kez varsa o kadarı atlanır; böylece aynı yedek iki kez yüklense de kopya oluşmaz.
 */
export const BACKUP_FORMAT = 'fis-tarayici-yedek';
export const BACKUP_VERSION = 1;
export const MANIFEST_NAME = 'yedek.json';

export interface BackupReceipt {
  id: string;
  created_at: string;
  firma_adi: string;
  tarih: string;
  toplam_tutar: number;
  kdv_yuzde1: number;
  kdv_yuzde10: number;
  kdv_yuzde20: number;
  kategori: Kategori;
  /** ZIP içindeki fotoğraf yolu; fotoğraf yoksa ya da yedeklenemediyse null */
  photo: string | null;
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  appVersion: string;
  receipts: BackupReceipt[];
}

export const photoEntryName = (id: string) => `fotograflar/${id.replace(/[^A-Za-z0-9-]/g, '')}.jpg`;

export function buildManifest(
  receipts: ReceiptRecord[],
  photos: ReadonlySet<string>,
  createdAt: string,
  appVersion: string,
): BackupManifest {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    appVersion,
    receipts: receipts.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      firma_adi: r.firma_adi,
      tarih: r.tarih,
      toplam_tutar: r.toplam_tutar,
      kdv_yuzde1: r.kdv_yuzde1,
      kdv_yuzde10: r.kdv_yuzde10,
      kdv_yuzde20: r.kdv_yuzde20,
      kategori: r.kategori,
      photo: photos.has(r.id) ? photoEntryName(r.id) : null,
    })),
  };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? round2(v) : null);

/** yedek.json içeriğini doğrular; bozuk ya da başka bir dosyaysa anlaşılır hata fırlatır. */
export function parseManifest(text: string): BackupManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Yedek dosyası okunamadı (yedek.json bozuk).');
  }
  const m = raw as Partial<BackupManifest> | null;
  if (!m || m.format !== BACKUP_FORMAT || !Array.isArray(m.receipts)) {
    throw new Error('Bu dosya bu uygulamanın yedeği değil.');
  }
  if (typeof m.version !== 'number' || m.version > BACKUP_VERSION) {
    throw new Error('Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Önce uygulamayı güncelleyin.');
  }
  const receipts: BackupReceipt[] = [];
  m.receipts.forEach((r: Partial<BackupReceipt>, i) => {
    const toplam = num(r?.toplam_tutar);
    const k1 = num(r?.kdv_yuzde1 ?? 0);
    const k10 = num(r?.kdv_yuzde10 ?? 0);
    const k20 = num(r?.kdv_yuzde20 ?? 0);
    const ok =
      r &&
      typeof r.firma_adi === 'string' &&
      r.firma_adi.trim() &&
      typeof r.tarih === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.tarih) &&
      toplam !== null &&
      k1 !== null &&
      k10 !== null &&
      k20 !== null &&
      (KATEGORILER as readonly string[]).includes(r.kategori as string);
    if (!ok) throw new Error(`Yedekteki ${i + 1}. fiş geçersiz; dosya bozulmuş olabilir.`);
    receipts.push({
      id: String(r.id ?? ''),
      created_at: typeof r.created_at === 'string' ? r.created_at : '',
      firma_adi: r.firma_adi!.trim(),
      tarih: r.tarih!,
      toplam_tutar: toplam,
      kdv_yuzde1: k1,
      kdv_yuzde10: k10,
      kdv_yuzde20: k20,
      kategori: r.kategori as Kategori,
      photo: typeof r.photo === 'string' && r.photo.startsWith('fotograflar/') ? r.photo : null,
    });
  });
  return { format: BACKUP_FORMAT, version: m.version, createdAt: String(m.createdAt ?? ''), appVersion: String(m.appVersion ?? ''), receipts };
}

/** Aynı fiş anahtarı: firma (büyük/küçük harf ve boşluk farkı yok sayılır) + tarih + tutar */
export function receiptKey(r: Pick<ReceiptRecord, 'firma_adi' | 'tarih' | 'toplam_tutar'>): string {
  return `${r.tarih}|${round2(r.toplam_tutar).toFixed(2)}|${r.firma_adi.trim().replace(/\s+/g, ' ').toLocaleUpperCase('tr-TR')}`;
}

/**
 * Hangi fişlerin ekleneceğini belirler. Bir anahtar hesapta n kez, yedekte m kez varsa
 * yalnızca m − n tanesi eklenir (aynı gün aynı tutarlı iki gerçek fiş de korunur).
 */
export function planRestore(
  backup: BackupReceipt[],
  existing: Pick<ReceiptRecord, 'firma_adi' | 'tarih' | 'toplam_tutar'>[],
): { toInsert: BackupReceipt[]; skipped: number } {
  const have = new Map<string, number>();
  for (const r of existing) have.set(receiptKey(r), (have.get(receiptKey(r)) ?? 0) + 1);
  const toInsert: BackupReceipt[] = [];
  for (const r of backup) {
    const k = receiptKey(r);
    const n = have.get(k) ?? 0;
    if (n > 0) have.set(k, n - 1);
    else toInsert.push(r);
  }
  return { toInsert, skipped: backup.length - toInsert.length };
}

/** "Fis_Yedek_2026-10-03.zip" */
export function backupFilename(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `Fis_Yedek_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.zip`;
}
