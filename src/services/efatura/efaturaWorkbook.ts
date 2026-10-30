import { buildXlsx, type Row, type SheetSpec } from '../../lib/xlsx';
import type { EFatura, Yon } from './qnbEfatura';

/**
 * Seçilen veya listelenen e-Faturaları Excel (.xlsx) tablosuna dönüştürür.
 */
export function buildEFaturaWorkbook(faturalar: EFatura[], periodLabel: string, yon: Yon): Uint8Array {
  const yonText = yon === 'gelen' ? 'Gelen' : 'Giden';
  const sheetTitle = `${yonText} e-Faturalar - ${periodLabel}`;

  const headerRow: Row = [
    { v: 'Tarih', s: 'header' },
    { v: 'Belge No', s: 'header' },
    { v: 'Firma / Ünvan', s: 'header' },
    { v: 'VKN / TCKN', s: 'header' },
    { v: 'Tür', s: 'header' },
    { v: 'Tip', s: 'header' },
    { v: 'Matrah', s: 'header' },
    { v: 'KDV', s: 'header' },
    { v: 'Tutar', s: 'header' },
    { v: 'Para Birimi', s: 'header' },
    { v: 'Durum', s: 'header' },
    { v: 'ETTN', s: 'header' },
  ];

  const dataRows: Row[] = faturalar.map((f) => {
    return [
      { v: f.tarih ? new Date(f.tarih) : null, s: 'date' },
      { v: f.belgeNo || '', s: 'text' },
      { v: f.unvan || '', s: 'text' },
      { v: f.vkn || '', s: 'text' },
      { v: f.tur === 'earsiv' ? 'e-Arşiv' : 'e-Fatura', s: 'text' },
      { v: f.tip === 'IADE' ? 'İade' : f.tip === 'TEVKIFAT' ? 'Tevkifat' : 'Satış', s: 'text' },
      { v: typeof f.matrah === 'number' ? f.matrah : null, s: 'money' },
      { v: typeof f.kdv === 'number' ? f.kdv : null, s: 'money' },
      { v: typeof f.tutar === 'number' ? f.tutar : 0, s: 'money' },
      { v: f.paraBirimi || 'TRY', s: 'text' },
      { v: f.iptal ? 'İptal' : 'Geçerli', s: 'text' },
      { v: f.ettn || '', s: 'text' },
    ];
  });

  const startRow = 4; // Excel 1-indexed row for first data item
  const endRow = startRow + faturalar.length - 1;

  const summaryRow: Row = [
    { v: 'Toplam', s: 'totalLabel' },
    { v: `${faturalar.length} fatura`, s: 'totalLabel' },
    { v: '', s: 'totalLabel' },
    { v: '', s: 'totalLabel' },
    { v: '', s: 'totalLabel' },
    { v: '', s: 'totalLabel' },
    { v: faturalar.reduce((acc, f) => acc + (f.matrah ?? 0), 0), f: faturalar.length ? `SUM(G${startRow}:G${endRow})` : undefined, s: 'totalMoney' },
    { v: faturalar.reduce((acc, f) => acc + (f.kdv ?? 0), 0), f: faturalar.length ? `SUM(H${startRow}:H${endRow})` : undefined, s: 'totalMoney' },
    { v: faturalar.reduce((acc, f) => acc + (f.tutar ?? 0), 0), f: faturalar.length ? `SUM(I${startRow}:I${endRow})` : undefined, s: 'totalMoney' },
    { v: '', s: 'totalLabel' },
    { v: '', s: 'totalLabel' },
    { v: '', s: 'totalLabel' },
  ];

  const rows: (Row | undefined)[] = [
    [{ v: sheetTitle, s: 'title' }],
    undefined,
    headerRow,
    ...dataRows,
    summaryRow,
  ];

  const sheet: SheetSpec = {
    name: 'e-Faturalar',
    rows,
    freezeRows: 3,
    widths: [12, 18, 36, 14, 12, 12, 14, 12, 16, 10, 10, 38],
  };

  return buildXlsx([sheet]);
}
