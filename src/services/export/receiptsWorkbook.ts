import { round2 } from '../../lib/format';
import { buildXlsx, type Row } from '../../lib/xlsx';
import { KATEGORI_ETIKETLERI, type ReceiptRecord } from '../../types/receipt';

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

/**
 * Dönemin fişlerini muhasebeciye gönderilecek bir Excel dosyası olarak üretir.
 * "Fişler": tarih sırasıyla tüm fişler ve formüllü toplam satırı. "Özet": toplamlar, KDV ve kategori dağılımı.
 */
export function buildReceiptsWorkbook(summary: WorkbookInput, periodLabel: string): Uint8Array {
  const fisler = [...summary.fisler].sort((a, b) => a.tarih.localeCompare(b.tarih) || a.created_at.localeCompare(b.created_at));
  const header: Row = ['Tarih', 'Firma', 'Kategori', 'Toplam', 'KDV %1', 'KDV %10', 'KDV %20', 'Toplam KDV', 'KDV Hariç'].map((v) => ({ v, s: 'header' as const }));

  const rows: Row[] = [header];
  fisler.forEach((r, i) => {
    const n = i + 2; // Excel satır numarası
    const kdv = round2(r.kdv_yuzde1 + r.kdv_yuzde10 + r.kdv_yuzde20);
    rows.push([
      { v: localDate(r.tarih), s: 'date' },
      r.firma_adi,
      KATEGORI_ETIKETLERI[r.kategori] ?? r.kategori,
      { v: r.toplam_tutar, s: 'money' },
      { v: r.kdv_yuzde1, s: 'money' },
      { v: r.kdv_yuzde10, s: 'money' },
      { v: r.kdv_yuzde20, s: 'money' },
      { v: kdv, f: `E${n}+F${n}+G${n}`, s: 'money' },
      { v: round2(r.toplam_tutar - kdv), f: `D${n}-H${n}`, s: 'money' },
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
  ]);

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
      KATEGORI_ETIKETLERI[k.kategori] ?? k.kategori,
      { v: k.toplam, s: 'money' },
      { v: k.toplam / total, s: 'percent' },
    ]),
  ];

  return buildXlsx([
    { name: 'Fişler', rows, widths: [12, 34, 14, 14, 12, 12, 12, 14, 14], freezeRows: 1 },
    { name: 'Özet', rows: ozet, widths: [22, 16, 10] },
  ]);
}

function localDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
