import { formatTL, round2 } from '../../lib/format';
import { imageSize } from '../../lib/imageSize';
import { buildXlsx, cellRef, colWidthPx, EMU_PER_PT, EMU_PER_PX, type Row, type SheetImage, type SheetLink, type SheetSpec, XlsxWriter } from '../../lib/xlsx';
import { categoryLabel } from '../../lib/categories';
import type { ReceiptRecord } from '../../types/receipt';

/** getSummary'nin döndürdüğü özetin, Excel için gereken kısmı (saf veri; React Native bağımlılığı yok) */
export interface WorkbookInput {
  toplamGider: number;
  toplamKdv: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  kategoriToplamlari: { kategori: ReceiptRecord['kategori']; toplam: number }[];
  fisler: ReceiptRecord[];
}

/** Fotoğrafı Excel'e eklenmiş fiş: görsel numarası ve piksel boyutu */
export interface EmbeddedPhoto {
  media: number;
  width: number;
  height: number;
}

/** Fiş kimliği → eklenen fotoğraf ya da indirilemedi ('failed') */
export type PhotoMap = Map<string, EmbeddedPhoto | 'failed'>;

const FISLER = 'Fişler';
/** Fişler sayfasında küçük resim sütunu ve satır yüksekliği */
const PHOTO_COL = 9; // J
const PHOTO_COL_WIDTH = 11;
/** Fişler sayfasının sağındaki ek bilgi sütunları */
const EXTRA_TITLES = ['Fiş No', 'VKN/TCKN', 'Etiketler', 'Not'];
const EXTRA_WIDTHS = [12, 14, 24, 40];
const PHOTO_ROW_PT = 60;
const THUMB_MARGIN_PT = 2;

/**
 * Dönemin fişlerini muhasebeciye gönderilecek bir Excel dosyası olarak üretir.
 * "Fişler": tarih sırasıyla tüm fişler ve formüllü toplam satırı. "Özet": toplamlar, KDV ve kategori dağılımı.
 * Fişler birden çok aya yayılıyorsa "Aylar": aylık KDV beyannamesi için ay ay toplamlar.
 */
export function buildReceiptsWorkbook(summary: WorkbookInput, periodLabel: string): Uint8Array {
  return buildXlsx(receiptsSheets(summary, periodLabel));
}

export interface PhotoWorkbookResult {
  photos: number;
  /** İndirilemeyen ya da tanınmayan fotoğraf sayısı (dosya yine de oluşturulur) */
  failed: number;
}

/**
 * Fotoğraflı Excel: her fiş satırında küçük resim, tıklanınca kendi sayfasında ("Fiş 1"…) tam boyutlu hâline gider.
 * Fotoğraf dosyaya bir kez girer (küçük resim ve tam boyut aynı görseli kullanır). Akış olarak üretilir:
 * her fotoğraf indirilir indirilmez dosyaya yazılıp bellekten bırakılır.
 */
export async function writeReceiptsWorkbookWithPhotos(
  summary: WorkbookInput,
  periodLabel: string,
  sink: (chunk: Uint8Array) => void,
  fetchPhoto: (path: string) => Promise<Uint8Array>,
  onProgress?: (done: number, total: number) => void,
): Promise<PhotoWorkbookResult> {
  const writer = new XlsxWriter(sink);
  const withPhoto = summary.fisler.filter((r) => r.image_path);
  const photos: PhotoMap = new Map();
  // Aynı anda en fazla 4 indirme (hız ve bellek dengesi); dosyaya ekleme sırayla (tek iş parçacığı)
  let next = 0;
  let done = 0;
  let aborted = false;
  onProgress?.(0, withPhoto.length);
  async function worker() {
    while (!aborted && next < withPhoto.length) {
      const r = withPhoto[next++];
      let bytes: Uint8Array | null = null;
      try {
        bytes = await fetchPhoto(r.image_path!);
      } catch {
        bytes = null;
      }
      if (aborted) return;
      const size = bytes ? imageSize(bytes) : null;
      if (bytes && size) {
        try {
          photos.set(r.id, { media: writer.addImage(bytes, size.ext), width: size.width, height: size.height });
        } catch (e) {
          aborted = true; // yazma hatası (ör. disk dolu): diğer işçiler de dursun
          throw e;
        }
      } else {
        photos.set(r.id, 'failed');
      }
      onProgress?.(++done, withPhoto.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, withPhoto.length) }, worker));
  writer.finish(receiptsSheets(summary, periodLabel, photos));
  const failed = [...photos.values()].filter((p) => p === 'failed').length;
  return { photos: photos.size - failed, failed };
}

/** Çalışma kitabının sayfaları; `photos` verilirse küçük resim sütunu ve her fotoğraf için bir sayfa eklenir. */
export function receiptsSheets(summary: WorkbookInput, periodLabel: string, photos?: PhotoMap): SheetSpec[] {
  const fisler = [...summary.fisler].sort((a, b) => a.tarih.localeCompare(b.tarih) || a.created_at.localeCompare(b.created_at));
  const withPhotos = !!photos?.size;
  // Fotoğraf sütunu tutarların hemen yanında (J) kalır; ek bilgiler en sağda
  const titles = ['Tarih', 'Firma', 'Kategori', 'Toplam', 'KDV %1', 'KDV %10', 'KDV %20', 'Toplam KDV', 'KDV Hariç', ...(withPhotos ? ['Fotoğraf'] : []), ...EXTRA_TITLES];
  const header: Row = titles.map((v) => ({ v, s: 'header' as const }));

  const rows: Row[] = [header];
  fisler.forEach((r, i) => {
    const n = i + 2; // Excel satır numarası
    const kdv = round2(r.kdv_yuzde1 + r.kdv_yuzde10 + r.kdv_yuzde20);
    rows.push([
      { v: localDate(r.tarih), s: 'date' },
      r.firma_adi,
      categoryLabel(r.kategori),
      { v: r.toplam_tutar, s: 'money' },
      { v: r.kdv_yuzde1, s: 'money' },
      { v: r.kdv_yuzde10, s: 'money' },
      { v: r.kdv_yuzde20, s: 'money' },
      { v: kdv, f: `E${n}+F${n}+G${n}`, s: 'money' },
      { v: round2(r.toplam_tutar - kdv), f: `D${n}-H${n}`, s: 'money' },
      ...(withPhotos ? [''] : []),
      r.fis_no ?? '',
      r.vkn ?? '',
      (r.etiketler ?? []).join(', '),
      r.notlar ?? '',
    ]);
  });

  const last = fisler.length + 1;
  const sum = (col: string, value: number) => ({ v: round2(value), f: fisler.length ? `SUM(${col}2:${col}${last})` : undefined, s: 'totalMoney' as const });
  rows.push([
    { v: 'TOPLAM', s: 'totalLabel' },
    { v: `${fisler.length} fiş`, s: 'totalLabel' },
    { v: '', s: 'totalLabel' },
    sum('D', summary.toplamGider),
    sum('E', summary.kdv1),
    sum('F', summary.kdv10),
    sum('G', summary.kdv20),
    sum('H', summary.toplamKdv),
    sum('I', summary.toplamGider - summary.toplamKdv),
    ...(withPhotos ? [{ v: '', s: 'totalLabel' as const }] : []),
    ...EXTRA_TITLES.map(() => ({ v: '', s: 'totalLabel' as const })),
  ]);

  const widths = [12, 34, 14, 14, 12, 12, 12, 14, 14, ...(withPhotos ? [PHOTO_COL_WIDTH] : []), ...EXTRA_WIDTHS];
  const fislerSheet: SheetSpec = { name: FISLER, rows, widths, freezeRows: 1 };
  const photoPages = withPhotos ? photoSheets(fisler, photos!, fislerSheet) : [];

  const total = summary.toplamGider || 1;
  const ozet: Row[] = [
    [{ v: `Gider Özeti — ${periodLabel}`, s: 'title' }],
    [{ v: `Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}`, s: 'muted' }],
    [],
    [{ v: 'Genel', s: 'header' }, { v: '', s: 'header' }],
    ['Fiş sayısı', fisler.length],
    ['Toplam gider', { v: summary.toplamGider, s: 'money' }],
    ['KDV hariç tutar', { v: round2(summary.toplamGider - summary.toplamKdv), s: 'money' }],
    [{ v: 'KDV alacağı', s: 'totalLabel' }, { v: summary.toplamKdv, s: 'totalMoney' }],
    [],
    [{ v: 'KDV Dağılımı', s: 'header' }, { v: '', s: 'header' }],
    ['%1', { v: summary.kdv1, s: 'money' }],
    ['%10', { v: summary.kdv10, s: 'money' }],
    ['%20', { v: summary.kdv20, s: 'money' }],
    [],
    [{ v: 'Kategori', s: 'header' }, { v: 'Tutar', s: 'header' }, { v: 'Pay', s: 'header' }],
    ...summary.kategoriToplamlari.map((k): Row => [
      categoryLabel(k.kategori),
      { v: k.toplam, s: 'money' },
      { v: k.toplam / total, s: 'percent' },
    ]),
  ];

  const months = monthlyRows(fisler);
  return [
    fislerSheet,
    { name: 'Özet', rows: ozet, widths: [22, 16, 10] },
    ...(months ? [{ name: 'Aylar', rows: months, widths: [16, 8, 14, 12, 12, 12, 14, 14], freezeRows: 1 }] : []),
    ...photoPages,
  ];
}

/**
 * Fişler sayfasına küçük resimleri ekler (yerinde) ve her fotoğraf için ayrı bir sayfa döner ("Fiş 1", "Fiş 2"…).
 * Ayrı sayfa: Excel bir bağlantıyı izlerken hedef hücreyi ekranın üstüne getirmiyor, yalnızca görünür kılıyor;
 * fotoğraflar tek sayfada alt alta olunca önceki fotoğraf görünüyor ("kayma"). Kendi sayfasında her zaman en üstten açılır.
 * Her sayfa: başlık (tarih · firma · tutar), sabit duran "Fişlere dön" düğmesi, gerçek boyutunda fotoğraf.
 */
function photoSheets(fisler: WorkbookInput['fisler'], photos: PhotoMap, sheet: SheetSpec): SheetSpec[] {
  const thumbs: SheetImage[] = [];
  const thumbLinks: SheetLink[] = [];
  const thumbHeights: Record<number, number> = {};
  const sheets: SheetSpec[] = [];
  const margin = THUMB_MARGIN_PT * EMU_PER_PT;
  const colEmu = colWidthPx(PHOTO_COL_WIDTH) * EMU_PER_PX;
  const boxH = PHOTO_ROW_PT * EMU_PER_PT - 2 * margin;
  const boxW = colEmu - 2 * margin;

  fisler.forEach((r, i) => {
    const row = i + 1; // Fişler sayfasında (başlıktan sonra) satır indeksi
    const photo = photos.get(r.id);
    if (!photo) return;
    if (photo === 'failed') {
      sheet.rows[row]![PHOTO_COL] = { v: 'indirilemedi', s: 'muted' };
      return;
    }
    const name = `Fiş ${sheets.length + 1}`;
    const target = cellRef(name, 0, 0);
    const tooltip = 'Tam boyutlu fotoğrafı aç';

    // Küçük resim: satır yüksekliğine sığdırılır, hücrede ortalanır; tıklanınca fotoğrafın sayfasına gider
    const scale = Math.min(boxH / photo.height, boxW / photo.width);
    const w = photo.width * scale;
    const h = photo.height * scale;
    thumbHeights[row] = PHOTO_ROW_PT;
    thumbs.push({ media: photo.media, row, col: PHOTO_COL, width: w, height: h, colOff: (colEmu - w) / 2, rowOff: margin + (boxH - h) / 2, link: target, tooltip, descr: r.firma_adi });
    thumbLinks.push({ row, col: PHOTO_COL, location: target, tooltip });

    // Tam boyut: gerçek piksel boyutunda (%100 yakınlaştırmada)
    sheets.push({
      name,
      rows: [[{ v: `${formatDate(r.tarih)} · ${r.firma_adi} · ${formatTL(r.toplam_tutar)}`, s: 'title' }], [{ v: '←  Fişlere dön', s: 'button' }]],
      rowHeights: { 0: 22, 1: 30, 2: 6 }, // 2: düğme ile fotoğraf arasında boşluk
      widths: [24],
      // Başlık ve düğme sabit: uzun fotoğrafı aşağı kaydırınca da "Fişlere dön" görünür kalır
      freezeRows: 2,
      links: [{ row: 1, col: 0, location: cellRef(FISLER, row, 0) }],
      images: [{ media: photo.media, row: 3, col: 0, width: photo.width * EMU_PER_PX, height: photo.height * EMU_PER_PX, descr: r.firma_adi }],
    });
  });

  if (sheets.length) {
    sheet.rowHeights = thumbHeights;
    sheet.images = thumbs;
    sheet.links = thumbLinks;
  }
  return sheets;
}

/** "2026-09-14" → "14.09.2026" */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Ay ay toplamlar (fişler tek aydaysa null) */
export function monthlyRows(fisler: ReceiptRecord[]): Row[] | null {
  const byMonth = new Map<string, { n: number; toplam: number; k1: number; k10: number; k20: number }>();
  for (const r of fisler) {
    const key = r.tarih.slice(0, 7);
    const m = byMonth.get(key) ?? { n: 0, toplam: 0, k1: 0, k10: 0, k20: 0 };
    m.n += 1;
    m.toplam += r.toplam_tutar;
    m.k1 += r.kdv_yuzde1;
    m.k10 += r.kdv_yuzde10;
    m.k20 += r.kdv_yuzde20;
    byMonth.set(key, m);
  }
  if (byMonth.size < 2) return null;

  const header: Row = ['Ay', 'Fiş', 'Toplam', 'KDV %1', 'KDV %10', 'KDV %20', 'Toplam KDV', 'KDV Hariç'].map((v) => ({ v, s: 'header' as const }));
  const rows: Row[] = [header];
  const keys = [...byMonth.keys()].sort();
  keys.forEach((key, i) => {
    const m = byMonth.get(key)!;
    const n = i + 2;
    const kdv = round2(m.k1 + m.k10 + m.k20);
    rows.push([
      `${AYLAR[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`,
      m.n,
      { v: round2(m.toplam), s: 'money' },
      { v: round2(m.k1), s: 'money' },
      { v: round2(m.k10), s: 'money' },
      { v: round2(m.k20), s: 'money' },
      { v: kdv, f: `D${n}+E${n}+F${n}`, s: 'money' },
      { v: round2(m.toplam - kdv), f: `C${n}-G${n}`, s: 'money' },
    ]);
  });
  const last = keys.length + 1;
  const col = (c: string, pick: (m: { n: number; toplam: number; k1: number; k10: number; k20: number }) => number, money = true) => ({
    v: round2([...byMonth.values()].reduce((a, m) => a + pick(m), 0)),
    f: `SUM(${c}2:${c}${last})`,
    s: money ? ('totalMoney' as const) : ('totalLabel' as const),
  });
  rows.push([
    { v: 'TOPLAM', s: 'totalLabel' },
    col('B', (m) => m.n, false),
    col('C', (m) => m.toplam),
    col('D', (m) => m.k1),
    col('E', (m) => m.k10),
    col('F', (m) => m.k20),
    col('G', (m) => m.k1 + m.k10 + m.k20),
    col('H', (m) => m.toplam - m.k1 - m.k10 - m.k20),
  ]);
  return rows;
}

function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
