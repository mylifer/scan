import { strToU8, zipSync } from 'fflate';

/**
 * Bağımlılıksız, küçük bir .xlsx yazıcı (fflate ile zip). React Native'de Blob'dan
 * binary oluşturulamadığı için hazır kütüphaneler yerine doğrudan Uint8Array üretir.
 */
export type CellStyle = 'text' | 'header' | 'money' | 'date' | 'totalLabel' | 'totalMoney' | 'title' | 'percent' | 'muted';

export interface Cell {
  /** Metin, sayı ya da tarih. Formülde önceden hesaplanmış değer. */
  v: string | number | Date | null;
  /** Excel formülü (başında "=" olmadan), ör. "SUM(D2:D9)" */
  f?: string;
  s?: CellStyle;
}

export type Row = (Cell | string | number | null)[];

export interface SheetSpec {
  name: string;
  rows: Row[];
  /** Sütun genişlikleri (karakter) */
  widths?: number[];
  /** Kaydırırken sabit kalacak üst satır sayısı */
  freezeRows?: number;
}

// styles.xml içindeki cellXfs sırası
const STYLE_INDEX: Record<CellStyle, number> = {
  text: 0,
  header: 1,
  money: 2,
  date: 3,
  totalLabel: 4,
  totalMoney: 5,
  title: 6,
  percent: 7,
  muted: 8,
};

export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes(sheets.length)),
    '_rels/.rels': strToU8(ROOT_RELS),
    'xl/workbook.xml': strToU8(workbook(sheets)),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels(sheets.length)),
    'xl/styles.xml': strToU8(STYLES),
  };
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(worksheet(sheet));
  });
  return zipSync(files, { level: 6 });
}

function worksheet({ rows, widths, freezeRows }: SheetSpec): string {
  const views = freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const cols = widths?.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const data = rows
    .map((row, r) => {
      const cells = row
        .map((raw, c) => {
          if (raw === null || raw === undefined) return '';
          const cell: Cell = typeof raw === 'object' ? raw : { v: raw };
          return cellXml(`${colName(c)}${r + 1}`, cell);
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}${cols}<sheetData>${data}</sheetData></worksheet>`;
}

function cellXml(ref: string, { v, f, s }: Cell): string {
  const style = s ? ` s="${STYLE_INDEX[s]}"` : '';
  const formula = f ? `<f>${escapeXml(f)}</f>` : '';
  if (v instanceof Date) return `<c r="${ref}"${style}>${formula}<v>${excelDate(v)}</v></c>`;
  if (typeof v === 'number') return `<c r="${ref}"${style}>${formula}<v>${Number.isFinite(v) ? v : 0}</v></c>`;
  if (v === null) return formula ? `<c r="${ref}"${style}>${formula}</c>` : `<c r="${ref}"${style}/>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

/** Excel tarih seri numarası (1900 sistemi); saat dilimi kaymasını önlemek için yerel gün kullanılır */
function excelDate(d: Date): number {
  return (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

export function colName(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // XML 1.0'da geçersiz kontrol karakterleri ve U+FFFE/U+FFFF
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    // Eşi olmayan vekil (surrogate) yarımlar: geçerli çiftler korunur, tek kalanlar atılır (OCR çıktısında görülebilir)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (m) => (m.length === 2 ? m : ''));
}

/** Sayfa adları: en fazla 31 karakter, : \ / ? * [ ] yasak */
function sheetName(name: string): string {
  return escapeXml(name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31));
}

function contentTypes(n: number): string {
  const sheets = Array.from(
    { length: n },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}</Types>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

function workbook(sheets: SheetSpec[]): string {
  const list = sheets.map((s, i) => `<sheet name="${sheetName(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${list}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`;
}

function workbookRels(n: number): string {
  const sheets = Array.from(
    { length: n },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

// numFmt 164: ₺ para birimi, 165: gg.aa.yyyy
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₺&quot;"/><numFmt numFmtId="165" formatCode="dd.mm.yyyy"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF8E8E93"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFC7C7CC"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF8E8E93"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
