import { strToU8, zipSync } from 'fflate';

import { ZipStream } from './zipStream';

/**
 * Bağımlılıksız, küçük bir .xlsx yazıcı (fflate ile zip). React Native'de Blob'dan
 * binary oluşturulamadığı için hazır kütüphaneler yerine doğrudan Uint8Array üretir.
 */
export type CellStyle = 'text' | 'header' | 'money' | 'date' | 'totalLabel' | 'totalMoney' | 'title' | 'percent' | 'muted' | 'link';

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
  /** Satırlar; boş bırakılan (undefined) satırlar yazılmaz */
  rows: (Row | undefined)[];
  /** Sütun genişlikleri (karakter) */
  widths?: number[];
  /** Kaydırırken sabit kalacak üst satır sayısı */
  freezeRows?: number;
  /** Satır yükseklikleri (punto), satır indeksi 0'dan */
  rowHeights?: Record<number, number>;
  /** Tüm satırların varsayılan yüksekliği (punto); verilirse sabitlenir (resim yerleşimi buna göre hesaplanır) */
  defaultRowHeight?: number;
  /** Hücrelere bağlı resimler (XlsxWriter.addImage ile eklenen görseller) */
  images?: SheetImage[];
  /** Çalışma kitabı içi bağlantılar (ör. cellRef('Fotoğraflar', 4, 0)) */
  links?: SheetLink[];
}

/** Bir hücrenin sol üst köşesine bağlı resim. Boyutlar EMU (1 px = 9525, 1 pt = 12700). */
export interface SheetImage {
  /** addImage'ın döndürdüğü görsel numarası; aynı görsel birden çok yerde kullanılabilir (dosyaya bir kez girer) */
  media: number;
  row: number;
  col: number;
  width: number;
  height: number;
  /** Hücre içindeki kaydırma (EMU) */
  colOff?: number;
  rowOff?: number;
  /** Tıklanınca gidilecek yer (çalışma kitabı içi, cellRef ile) */
  link?: string;
  tooltip?: string;
  /** Alternatif metin */
  descr?: string;
}

export interface SheetLink {
  row: number;
  col: number;
  /** Gidilecek yer (cellRef ile) */
  location: string;
  tooltip?: string;
}

export const EMU_PER_PX = 9525;
export const EMU_PER_PT = 12700;

/** Sütun genişliği (karakter) → yaklaşık piksel (Calibri 11, Excel'in hesabı) */
export function colWidthPx(chars: number): number {
  return Math.trunc(chars * 7 + 5);
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
  link: 9,
};

/** Tüm çalışma kitabını bellekte üretir (resimsiz küçük dosyalar için). */
export function buildXlsx(sheets: SheetSpec[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const [name, xml] of workbookParts(sheets, [])) files[name] = strToU8(xml);
  return zipSync(files, { level: 6 });
}

/**
 * Akış (streaming) .xlsx yazıcı: resimler eklendikçe ZIP'e yazılıp bellekten bırakılır,
 * sayfalar en sonda finish ile yazılır. Çıktı parça parça `sink`e gider (dosya ya da bellek).
 */
export class XlsxWriter {
  private zip: ZipStream;
  private media: ('jpeg' | 'png')[] = [];

  constructor(sink: (chunk: Uint8Array) => void) {
    this.zip = new ZipStream(sink);
  }

  /** Görseli dosyaya ekler, sayfalarda kullanılacak numarasını döner. JPEG/PNG zaten sıkıştırılmış olduğundan yeniden sıkıştırılmaz. */
  addImage(bytes: Uint8Array, ext: 'jpeg' | 'png'): number {
    this.media.push(ext);
    const id = this.media.length;
    this.zip.add(`xl/media/image${id}.${ext}`, bytes, false);
    return id;
  }

  finish(sheets: SheetSpec[]): void {
    for (const [name, xml] of workbookParts(sheets, this.media)) this.zip.add(name, strToU8(xml), true);
    this.zip.end();
  }
}

/** Resimler dışındaki tüm XML parçaları (dosya adı → içerik) */
function workbookParts(sheets: SheetSpec[], media: ('jpeg' | 'png')[]): [string, string][] {
  const drawingOf = new Map<number, number>(); // sayfa indeksi → çizim numarası
  sheets.forEach((s, i) => {
    if (s.images?.length) drawingOf.set(i, drawingOf.size + 1);
  });
  const parts: [string, string][] = [
    ['[Content_Types].xml', contentTypes(sheets.length, drawingOf.size)],
    ['_rels/.rels', ROOT_RELS],
    ['xl/workbook.xml', workbook(sheets)],
    ['xl/_rels/workbook.xml.rels', workbookRels(sheets.length)],
    ['xl/styles.xml', STYLES],
  ];
  sheets.forEach((sheet, i) => {
    const drawing = drawingOf.get(i);
    parts.push([`xl/worksheets/sheet${i + 1}.xml`, worksheet(sheet, drawing !== undefined)]);
    if (drawing === undefined) return;
    parts.push([`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, rels(`<Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${drawing}.xml"/>`)]);
    const { xml, relsXml } = drawingXml(sheet.images!, media);
    parts.push([`xl/drawings/drawing${drawing}.xml`, xml], [`xl/drawings/_rels/drawing${drawing}.xml.rels`, relsXml]);
  });
  return parts;
}

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function rels(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${body}</Relationships>`;
}

function drawingXml(images: SheetImage[], media: ('jpeg' | 'png')[]): { xml: string; relsXml: string } {
  const relList: string[] = [];
  const mediaRel = new Map<number, string>();
  const rel = (type: string, target: string) => {
    const id = `rId${relList.length + 1}`;
    relList.push(`<Relationship Id="${id}" Type="${REL}/${type}" Target="${escapeXml(target)}"/>`);
    return id;
  };
  const anchors = images
    .map((img, i) => {
      let blip = mediaRel.get(img.media);
      if (!blip) {
        blip = rel('image', `../media/image${img.media}.${media[img.media - 1] ?? 'jpeg'}`);
        mediaRel.set(img.media, blip);
      }
      const w = Math.round(img.width);
      const h = Math.round(img.height);
      const link = img.link
        ? `<a:hlinkClick r:id="${rel('hyperlink', `#${img.link}`)}"${img.tooltip ? ` tooltip="${escapeXml(img.tooltip)}"` : ''}/>`
        : '';
      const descr = img.descr ? ` descr="${escapeXml(img.descr)}"` : '';
      return (
        `<xdr:oneCellAnchor><xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>${Math.round(img.colOff ?? 0)}</xdr:colOff>` +
        `<xdr:row>${img.row}</xdr:row><xdr:rowOff>${Math.round(img.rowOff ?? 0)}</xdr:rowOff></xdr:from><xdr:ext cx="${w}" cy="${h}"/>` +
        `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Resim ${i + 1}"${descr}>${link}</xdr:cNvPr>` +
        `<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip r:embed="${blip}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
        `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`
      );
    })
    .join('');
  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}">${anchors}</xdr:wsDr>`,
    relsXml: rels(relList.join('')),
  };
}

function worksheet({ rows, widths, freezeRows, rowHeights, defaultRowHeight, links }: SheetSpec, hasDrawing: boolean): string {
  const views = freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const format = defaultRowHeight ? `<sheetFormatPr defaultRowHeight="${defaultRowHeight}" customHeight="1"/>` : '';
  const cols = widths?.length
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const count = Math.max(rows.length, ...Object.keys(rowHeights ?? {}).map((k) => Number(k) + 1));
  let data = '';
  for (let r = 0; r < count; r++) {
    const row = rows[r];
    const ht = rowHeights?.[r];
    if (!row && ht === undefined) continue;
    const cells = (row ?? [])
      .map((raw, c) => {
        if (raw === null || raw === undefined) return '';
        const cell: Cell = typeof raw === 'object' ? raw : { v: raw };
        return cellXml(`${colName(c)}${r + 1}`, cell);
      })
      .join('');
    data += `<row r="${r + 1}"${ht !== undefined ? ` ht="${ht}" customHeight="1"` : ''}>${cells}</row>`;
  }
  const hyperlinks = links?.length
    ? `<hyperlinks>${links
        .map((l) => `<hyperlink ref="${colName(l.col)}${l.row + 1}" location="${escapeXml(l.location)}"${l.tooltip ? ` tooltip="${escapeXml(l.tooltip)}"` : ''}/>`)
        .join('')}</hyperlinks>`
    : '';
  const drawing = hasDrawing ? '<drawing r:id="rId1"/>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}">${views}${format}${cols}<sheetData>${data}</sheetData>${hyperlinks}${drawing}</worksheet>`;
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
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    // Eşi olmayan vekil (surrogate) yarımlar: geçerli çiftler korunur, tek kalanlar atılır (OCR çıktısında görülebilir)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (m) => (m.length === 2 ? m : ''));
}

/** Sayfa adları: en fazla 31 karakter, : \ / ? * [ ] yasak */
function cleanSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
}

function sheetName(name: string): string {
  return escapeXml(cleanSheetName(name));
}

/** Bağlantılar için hücre adresi: "'Fotoğraflar'!A5" (satır/sütun 0'dan) */
export function cellRef(sheet: string, row: number, col: number): string {
  return `'${cleanSheetName(sheet).replace(/'/g, "''")}'!${colName(col)}${row + 1}`;
}

function contentTypes(n: number, drawings: number): string {
  const sheets = Array.from(
    { length: n },
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  const drawingTypes = Array.from(
    { length: drawings },
    (_, i) => `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
  ).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets}${drawingTypes}</Types>`;
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

// numFmt 164: ₺ para birimi, 165: gg.aa.yyyy. Yazı tipi 4: bağlantı (mavi, altı çizili).
// Tüm hücreler dikeyde ortalı (küçük resimli yüksek satırlarda yazılar ortada dursun)
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₺&quot;"/><numFmt numFmtId="165" formatCode="dd.mm.yyyy"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF8E8E93"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFC7C7CC"/></bottom><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF8E8E93"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="164" fontId="1" fillId="0" borderId="2" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
