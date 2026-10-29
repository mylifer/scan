// QNB eSolutions connectorService için SOAP yardımcıları. Deno'ya özgü API kullanmaz; birim testleri
// (src/__tests__/qnbSoap.test.ts) Node'da da çalıştırır.
//
// Yalnızca okuma metotları kullanılır: e-Fatura için gelenBelgeleriListeleExt, gidenBelgeleriListele,
// gelenBelgeIndirExt/gidenBelgeIndirExt; e-Arşiv için faturaListeSorgula.
// belgelerAlindi, faturaIptalEt gibi durum değiştiren metotlar bilerek yoktur.

export const QNB_URL = 'https://connector.qnbesolutions.com.tr/connector/ws/connectorService';
export const EARSIV_URL = 'https://earsivconnector.qnbesolutions.com.tr/earsiv/ws/EarsivWebService';
const NS_EFATURA = 'http://service.connector.uut.cs.com.tr/';
const NS_EARSIV = 'http://service.earsiv.uut.cs.com.tr/';

export type Yon = 'gelen' | 'giden';

/** Uygulamaya dönen sade fatura satırı */
export interface EFatura {
  ettn: string;
  belgeNo: string;
  /** YYYY-MM-DD */
  tarih: string;
  /** Gelen faturada satıcı, giden faturada alıcı */
  unvan: string;
  vkn: string;
  tutar: number;
  paraBirimi: string;
  /** TEMELFATURA, TICARIFATURA, ENERJI, EARSIVFATURA… */
  profil: string;
  /** e-Fatura mı e-Arşiv mi (yoksa e-Fatura) */
  tur?: 'efatura' | 'earsiv';
  /** İptal edilmiş e-Arşiv faturası */
  iptal?: boolean;
  /** Toplam KDV ve KDV hariç mal/hizmet tutarı (QNB tutar bilgisinden) */
  kdv?: number;
  matrah?: number;
  /** SATIS, IADE, TEVKIFAT… (giden portal belgeTipi ya da UBL InvoiceTypeCode) */
  tip?: string;
  /** Gönderilmemiş taslak (geçici numara "---…"); listede ve toplamlarda gösterilmez */
  taslak?: boolean;
}

export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function xmlUnescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

/**
 * WS-Security UsernameToken başlıklı SOAP 1.1 zarfı. Liste metotları parametreleri <parametreler> içinde,
 * indirme ve e-Arşiv metotları doğrudan alır (wrap: false).
 */
export function buildEnvelope(
  op: string,
  params: Record<string, string>,
  user: string,
  pass: string,
  opts: { earsiv?: boolean; wrap?: boolean } = {},
): string {
  const ns = opts.earsiv ? NS_EARSIV : NS_EFATURA;
  const wrap = opts.wrap ?? !opts.earsiv;
  let body = Object.entries(params)
    .map(([k, v]) => `<${k}>${xmlEscape(v)}</${k}>`)
    .join('');
  if (wrap) body = `<parametreler>${body}</parametreler>`;
  return (
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${ns}">` +
    '<soapenv:Header><wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    `<wsse:UsernameToken><wsse:Username>${xmlEscape(user)}</wsse:Username><wsse:Password>${xmlEscape(pass)}</wsse:Password></wsse:UsernameToken>` +
    '</wsse:Security></soapenv:Header>' +
    `<soapenv:Body><ser:${op}>${body}</ser:${op}></soapenv:Body></soapenv:Envelope>`
  );
}

/** Dönem için istek: gelen faturalar fatura tarihine, giden faturalar gönderim tarihine göre listelenir. */
export function listRequest(yon: Yon, vkn: string, baslangic: string, bitis: string): { op: string; params: Record<string, string> } {
  if (yon === 'gelen') {
    // sonAlinanBelgeSiraNumarasi tarih aralığıyla birlikte gönderilemez (QNB reddediyor).
    // donusTipiVersiyon 6.0: satıcı unvanı ve ödenecek tutar listede gelir, faturayı indirmek gerekmez.
    return {
      op: 'gelenBelgeleriListeleExt',
      params: {
        vergiTcKimlikNo: vkn,
        belgeTuru: 'FATURA',
        donusTipiVersiyon: '6.0',
        faturaTarihiBaslangic: baslangic,
        faturaTarihiBitis: bitis,
        onayDurum: 'HEPSI',
      },
    };
  }
  return {
    op: 'gidenBelgeleriListele',
    params: { vkn, belgeTuru: 'FATURA', baslangicGonderimTarihi: baslangic, bitisGonderimTarihi: bitis },
  };
}

/**
 * Portaldan kesilen giden e-Faturalar gidenBelgeleriListele'de görünmüyor; gidenBelgeleriListelePortal
 * fatura tarihine göre listeler (alıcı unvanı ve tutar dahil). Tarihler YYYYAAGG.
 */
export function portalListRequest(vkn: string, baslangic: string, bitis: string): { op: string; params: Record<string, string> } {
  return {
    op: 'gidenBelgeleriListelePortal',
    params: { vergiTcKimlikNo: vkn, belgeTuru: 'FATURA', belgeVersiyon: '1.0', faturaBaslangicTarihi: baslangic, faturaBitisTarihi: bitis },
  };
}

/** Giden e-Faturaların tutarları (gönderim tarihine göre); parametreler sarmalsız gider */
export function tutarRequest(vkn: string, baslangic: string, bitis: string): { op: string; params: Record<string, string> } {
  return {
    op: 'gidenBelgeTutarBilgileriSorgula',
    params: { vergiTcKimlikNo: vkn, belgeTuru: 'FATURA', baslangicGonderimTarihi: baslangic, bitisGonderimTarihi: bitis },
  };
}

/** QNB tutar bilgisi satırı (gelen/giden…TutarBilgileri…Sorgula) */
export interface TutarSatiri {
  ettn: string;
  belgeNo: string;
  /** YYYY-MM-DD (fatura tarihi) */
  tarih: string;
  /** Gelen'de gönderen VKN */
  vkn: string;
  matrah: number;
  kdv: number;
  tevkifat: number;
  odenecek: number;
  paraBirimi: string;
  /** KDV oranına göre tutar: { "20": 24000, "10": 899.45 } */
  oranlar: Record<string, number>;
  /** Giden: SATIS / IADE … (sonradan eklenir) */
  tip?: string;
}

export function parseTutarRows(xml: string): TutarSatiri[] {
  return parseReturns(xml)
    .filter((r) => r.ettn)
    .map((r) => {
      const oranlar: Record<string, number> = {};
      for (const [k, v] of Object.entries(r)) {
        const m = k.match(/^kdv(\d+)Tutar$/);
        const n = parseTutar(v);
        if (m && Number.isFinite(n) && n) oranlar[m[1]!] = n;
      }
      const num = (k: string) => (Number.isFinite(parseTutar(r[k])) ? parseTutar(r[k]) : 0);
      return {
        ettn: r.ettn!,
        belgeNo: r.belgeNo ?? '',
        tarih: isoDate(r.belgeTarihi),
        vkn: r.gondericiVkn ?? '',
        matrah: num('malHizmetToplamTutari'),
        kdv: num('kdvToplamTutari'),
        tevkifat: num('kdvTevkifatTutari'),
        odenecek: num('odenecekTutar'),
        paraBirimi: r.odenecekTutarDovizCinsi || r.kdvToplamTutariDovizCinsi || 'TRY',
        oranlar,
      };
    });
}

/** gidenBelgeTutarBilgileriSorgula yanıtı → ETTN'ye göre ödenecek tutar */
export function parseTutarMap(xml: string): Map<string, { tutar: number; paraBirimi: string }> {
  const out = new Map<string, { tutar: number; paraBirimi: string }>();
  for (const r of parseTutarRows(xml)) if (r.odenecek) out.set(r.ettn, { tutar: r.odenecek, paraBirimi: r.paraBirimi });
  return out;
}

/** Gelen faturaların tutar/KDV bilgileri, fatura tarihine göre (QNB en fazla 100 satır döndürür) */
export function gelenTutarRequest(vkn: string, baslangic: string, bitis: string): { op: string; params: Record<string, string> } {
  return {
    op: 'gelenBelgeTutarBilgileriFaturaTarihineGoreSorgula',
    params: { vergiTcKimlikNo: vkn, belgeTuru: 'FATURA', baslangicFaturaTarihi: baslangic, bitisFaturaTarihi: bitis },
  };
}

/** QNB "X boş olamaz" dediğinde X için kullanılacak değer (bilinmeyen alan için yok) */
export const PORTAL_DEFAULTS: Record<string, string> = {
  belgeVersiyon: '1.0',
  pageCount: '1',
  subeKodu: 'DFLT',
};

/** "belgeVersiyon boş olamaz." → "belgeVersiyon" */
export function missingField(message: string): string | null {
  const m = message.match(/(\w+)\s+(?:boş olamaz|alanı boş|zorunlu|must not be (?:null|empty)|is required)/i);
  return m ? m[1]! : null;
}

/** SOAP Fault varsa mesajı, yoksa null */
export function parseFault(xml: string): string | null {
  if (!/<(\w+:)?Fault\b/.test(xml)) return null;
  const m = xml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/);
  return m ? xmlUnescape(m[1]!).trim() : 'Bilinmeyen SOAP hatası';
}

/** Kullanıcı adı/şifre hatası mı? Bu durumda tekrar denenmemeli (hesap kilitlenebilir). */
export function isLoginFault(message: string): boolean {
  return /username\.pwd|pwd\.mismatch|kullan[ıi]c[ıi]\s*ad[ıi]|şifre|parola|password|authenticat|unauthori[sz]ed|kilitl|locked|yetkisiz/i.test(message);
}

/** <return> (ya da verilen ad) öğelerinin yaprak alanlarını düz nesne olarak döndürür. */
export function parseReturns(xml: string, tag = 'return'): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const m of xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g'))) {
    const fields: Record<string, string> = {};
    for (const f of m[1]!.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) {
      fields[f[1]!] ??= xmlUnescape(f[2]!).trim();
    }
    out.push(fields);
  }
  return out;
}

/**
 * Tarih → YYYY-MM-DD. Tanınan biçimler: 2026-10-15(…), 20261015(…), 15.10.2026, 15/10/2026,
 * epoch milisaniye (Türkiye saatiyle). Tanınmazsa boş.
 */
export function isoDate(v: string | undefined): string {
  const s = (v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})[./](\d{2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{12,13}$/.test(s)) return new Date(Number(s) + 3 * 3_600_000).toISOString().slice(0, 10);
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return `${m[1]}-${m[2]}-${m[3]}`;
  return '';
}

/**
 * Tutar metni → sayı. "1234.56", "1.234,56", "1,234.56", "1234,56" biçimleri; okunamazsa NaN.
 */
export function parseTutar(v: string | undefined): number {
  let t = (v ?? '').replace(/[^\d.,-]/g, '');
  if (!t) return NaN;
  const comma = t.lastIndexOf(','), dot = t.lastIndexOf('.');
  if (comma > dot) t = t.replace(/\./g, '').replace(',', '.');
  else if (comma !== -1) t = t.replace(/,/g, '');
  return Number(t);
}

/** Verilen alanlardan ilk okunabilen tutar (yoksa 0) */
function firstAmount(r: Record<string, string>, keys: string[]): number {
  for (const k of keys) {
    const n = parseTutar(r[k]);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function toEFatura(r: Record<string, string>, yon: Yon): EFatura {
  // Giden: gidenBelgeleriListele(Data/DataExt) ve gidenBelgeleriListelePortal(Data) alanları da karşılanır
  const vkn = (yon === 'gelen' ? r.gonderenVknTckn : r.aliciVkn || r.alanVergiTcKimlikNo) ?? '';
  const unvan = (yon === 'gelen' ? r.saticiUnvan || r.gonderenIsim : r.aliciUnvan || r.receiverName) || vkn || 'Bilinmeyen firma';
  const tutar = firstAmount(r, ['odenecekTutar', 'payableAmount', 'tutar', 'toplamTutar']);
  return {
    ettn: r.ettn ?? '',
    belgeNo: r.belgeNo || r.invoiceID || r.yerelBelgeNo || '',
    tarih: isoDate(r.belgeTarihi),
    unvan,
    vkn,
    tutar,
    paraBirimi: r.odenecekTutarDovizCinsi || r.dovizCinsi || r.currency || 'TRY',
    profil: r.profileId || r.profileID || r.faturaSenaryo || r.belgeTipi || '',
    ...(r.belgeTipi ? { tip: r.belgeTipi } : {}),
    ...((r.belgeNo ?? '').startsWith('---') ? { taslak: true } : {}),
  };
}

/** Yeni tarihli fatura üstte */
export function parseList(xml: string, yon: Yon): EFatura[] {
  return parseReturns(xml)
    .map((r) => toEFatura(r, yon))
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.belgeNo.localeCompare(a.belgeNo));
}

// ---------------------------------------------------------------------------------------------
// e-Arşiv (giden): faturaListeSorgula. Girdi bir JSON metnidir; alan adları belgelenmediği için
// birkaç olası biçim sırayla denenir. Sonuç yine de tarih aralığına göre süzülür.

/** faturaListeSorgula'da bir sayfadaki en fazla fatura (QNB sınırı) */
export const EARSIV_PAGE = 100;

/**
 * e-Arşiv liste girdisi (FaturaSorgulamaInput). QNB'nin hata mesajlarına göre: mukellefVkn,
 * faturaTarihiBaslangic/Bitis YYYYAAGG, pagingLimit en fazla 100. Tarihler YYYY-MM-DD gelir.
 */
export function earsivListInput(vkn: string, baslangic: string, bitis: string, pagingStart: number): Record<string, string | number> {
  const c = (d: string) => d.replace(/-/g, '');
  return { mukellefVkn: vkn, faturaTarihiBaslangic: c(baslangic), faturaTarihiBitis: c(bitis), pagingStart, pagingLimit: EARSIV_PAGE };
}

/** e-Arşiv belge biçimleri (donenBelgeFormati) */
export const EARSIV_FORMAT = { UBL: 0, PDF: 3 } as const;

/** faturaSorgula girdileri: tek fatura UBL ya da PDF olarak */
export function earsivDocInputs(vkn: string, uuid: string, format: number): Record<string, string | number>[] {
  return [
    { faturaUuid: uuid, donenBelgeFormati: format },
    { vkn, faturaUuid: uuid, donenBelgeFormati: format },
    { mukellefVkn: vkn, faturaUuid: uuid, donenBelgeFormati: format },
  ];
}

/** faturaSorgula yanıtındaki <output><belgeIcerigi>base64</belgeIcerigi> */
export function parseEarsivDoc(xml: string): string | null {
  const m = xml.match(/<belgeIcerigi\b[^>]*>([A-Za-z0-9+/=\s]+)<\/belgeIcerigi>/);
  return m ? m[1]!.replace(/\s+/g, '') : null;
}

/** e-Arşiv sonuç kodu ve metni (<return><resultCode>…) */
export function parseEarsivResult(xml: string): { code: string; text: string } {
  const r = parseReturns(xml)[0] ?? {};
  return { code: r.resultCode ?? '', text: r.resultText ?? '' };
}

export const EARSIV_OK = 'AE00000';

export function earsivToEFatura(r: Record<string, string>): EFatura {
  const tutar = firstAmount(r, ['payableAmount', 'toplamTutar']);
  const vkn = r.receiverIdentifier ?? '';
  return {
    ettn: r.uuid ?? '',
    belgeNo: r.invoiceId ?? r.yerelFaturaNo ?? '',
    tarih: isoDate(r.issueDate || r.faturaZamani || r.duzenlenmeZamani),
    unvan: r.receiverName || r.receiverIdentifierTxt || vkn || 'Bilinmeyen alıcı',
    vkn,
    tutar,
    paraBirimi: r.currency || 'TRY',
    profil: r.profileId || 'EARSIVFATURA',
    tur: 'earsiv',
    iptal: !!r.iptalTarihi,
    ...(Number.isFinite(parseTutar(r.vergilerToplami)) ? { kdv: parseTutar(r.vergilerToplami) } : {}),
    ...(r.invoiceTypeCode ? { tip: r.invoiceTypeCode } : {}),
  };
}

/** faturaListeSorgula yanıtındaki <output> öğeleri; aralık dışındakiler atılır */
export function parseEarsivList(xml: string, baslangic: string, bitis: string): EFatura[] {
  return parseEarsivPage(xml, baslangic, bitis).list;
}

/** Bir e-Arşiv sayfası: süzülmüş liste, QNB'nin döndürdüğü ham kayıt sayısı ve tanı için örnek tarih alanları */
export function parseEarsivPage(xml: string, baslangic: string, bitis: string): { list: EFatura[]; ham: number; ornek?: string } {
  const raw = parseReturns(xml, 'output');
  const list = raw.map(earsivToEFatura).filter((f) => !f.tarih || (f.tarih >= baslangic && f.tarih <= bitis));
  const r = raw[0];
  const ornek = r
    ? ['issueDate', 'faturaZamani', 'duzenlenmeZamani', 'creationTime']
        .filter((k) => r[k])
        .map((k) => `${k}=${r[k]}`)
        .join(', ') || `alanlar: ${Object.keys(r).slice(0, 12).join(',')}`
    : undefined;
  return { list, ham: raw.length, ...(ornek ? { ornek } : {}) };
}

/** e-Fatura ve e-Arşiv listelerini birleştirir; aynı ETTN bir kez, yeni tarihli üstte */
export function mergeLists(...lists: EFatura[][]): EFatura[] {
  const seen = new Set<string>();
  const out: EFatura[] = [];
  for (const f of lists.flat()) {
    const k = f.ettn || `${f.belgeNo}:${f.tarih}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.sort((a, b) => b.tarih.localeCompare(a.tarih) || b.belgeNo.localeCompare(a.belgeNo));
}

// ---------------------------------------------------------------------------------------------
// Fatura detayı: e-Fatura UBL'i indirilir (base64 .zip) ve kalemler, KDV ve toplamlar çıkarılır.

export const ETTN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function detailRequest(yon: Yon, vkn: string, ettn: string, format: 'UBL' | 'PDF' = 'UBL'): { op: string; params: Record<string, string> } {
  return {
    op: yon === 'gelen' ? 'gelenBelgeIndirExt' : 'gidenBelgeIndirExt',
    params: { vergiTcKimlikNo: vkn, belgeEttn: ettn, belgeTuru: 'FATURA', belgeFormati: format },
  };
}

/** <return>base64</return> */
export function parseBase64Return(xml: string): string | null {
  const m = xml.match(/<return\b[^>]*>([A-Za-z0-9+/=\s]+)<\/return>/);
  return m ? m[1]!.replace(/\s+/g, '') : null;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** İndirilen belgeden istenen dosya: zip ise içindeki .xml/.pdf, değilse olduğu gibi */
export function extractFile(bytes: Uint8Array, unzip: (b: Uint8Array) => Record<string, Uint8Array>, ext: 'xml' | 'pdf'): Uint8Array {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzip(bytes);
    const names = Object.keys(files);
    const name = names.find((n) => n.toLowerCase().endsWith(`.${ext}`)) ?? names[0];
    if (!name) throw new Error('İndirilen arşiv boş.');
    return files[name]!;
  }
  return bytes;
}

/** İndirilen belgeden UBL XML metni */
export function extractXml(bytes: Uint8Array, unzip: (b: Uint8Array) => Record<string, Uint8Array>): string {
  return new TextDecoder('utf-8').decode(extractFile(bytes, unzip, 'xml'));
}

export interface FaturaKalem {
  ad: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  /** KDV hariç satır tutarı */
  tutar: number;
  kdvOrani: number;
  kdvTutari: number;
}

export interface FaturaDetay {
  belgeNo: string;
  /** InvoiceTypeCode: SATIS, IADE, TEVKIFAT… */
  tip: string;
  tarih: string;
  saticiUnvan: string;
  saticiVkn: string;
  aliciUnvan: string;
  aliciVkn: string;
  paraBirimi: string;
  kalemler: FaturaKalem[];
  kdvler: { oran: number; matrah: number; tutar: number }[];
  /** Mal/hizmet toplamı (KDV hariç) */
  araToplam: number;
  iskonto: number;
  kdvToplam: number;
  odenecek: number;
  notlar: string[];
}

const P = '(?:[\\w-]+:)?';
/** Ad alanı önekinden bağımsız ilk öğenin içi */
function block(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${P}${tag}\\b[^>]*>([\\s\\S]*?)<\\/${P}${tag}>`));
  return m ? m[1]! : '';
}
function blocks(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${P}${tag}\\b[^>]*>([\\s\\S]*?)<\\/${P}${tag}>`, 'g'))].map((m) => m[1]!);
}
/** CDATA içeriğini kaçışlı metne çevirir (etiket temizliğinde silinmesin) */
function cdata(xml: string): string {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c: string) => xmlEscape(c));
}
function text(xml: string, tag: string): string {
  return xmlUnescape(cdata(block(xml, tag)).replace(/<[^>]+>/g, '')).trim();
}
function num(xml: string, tag: string): number {
  const n = Number(text(xml, tag));
  return Number.isFinite(n) ? n : 0;
}
function attr(xml: string, tag: string, name: string): string {
  const m = xml.match(new RegExp(`<${P}${tag}\\b[^>]*\\b${name}="([^"]*)"`));
  return m ? m[1]! : '';
}

function party(xml: string): { unvan: string; vkn: string } {
  const p = block(xml, 'Party');
  let vkn = '';
  for (const id of p.matchAll(new RegExp(`<${P}ID\\b[^>]*schemeID="(VKN|TCKN)"[^>]*>([^<]*)<`, 'g'))) {
    vkn = id[2]!.trim();
    break;
  }
  const person = block(p, 'Person');
  const kisi = person ? `${text(person, 'FirstName')} ${text(person, 'FamilyName')}`.trim() : '';
  return { unvan: text(block(p, 'PartyName'), 'Name') || kisi || vkn, vkn };
}

/** UBL-TR faturasından ekranda gösterilecek özet */
export function parseUbl(xml: string): FaturaDetay {
  const lines = blocks(xml, 'InvoiceLine');
  // Belge düzeyindeki KDV ve toplamlar, satırlar çıkarıldıktan sonra aranır
  const head = xml.replace(new RegExp(`<${P}InvoiceLine\\b[\\s\\S]*?<\\/${P}InvoiceLine>`, 'g'), '');
  const kalemler: FaturaKalem[] = lines.map((l) => {
    const tax = block(l, 'TaxSubtotal');
    return {
      ad: text(block(l, 'Item'), 'Name') || text(l, 'Note') || 'Kalem',
      miktar: num(l, 'InvoicedQuantity'),
      birim: attr(l, 'InvoicedQuantity', 'unitCode'),
      birimFiyat: num(block(l, 'Price'), 'PriceAmount'),
      tutar: num(l, 'LineExtensionAmount'),
      kdvOrani: num(tax, 'Percent'),
      kdvTutari: num(block(l, 'TaxTotal'), 'TaxAmount'),
    };
  });
  const taxTotal = block(head.replace(new RegExp(`<${P}WithholdingTaxTotal\\b[\\s\\S]*?<\\/${P}WithholdingTaxTotal>`, 'g'), ''), 'TaxTotal');
  const kdvler = blocks(taxTotal, 'TaxSubtotal')
    .filter((t) => /^0015$/.test(text(block(t, 'TaxScheme'), 'TaxTypeCode')) || !text(block(t, 'TaxScheme'), 'TaxTypeCode'))
    .map((t) => ({ oran: num(t, 'Percent'), matrah: num(t, 'TaxableAmount'), tutar: num(t, 'TaxAmount') }));
  const total = block(head, 'LegalMonetaryTotal');
  const sup = party(block(head, 'AccountingSupplierParty'));
  const cus = party(block(head, 'AccountingCustomerParty'));
  return {
    belgeNo: text(head, 'ID'),
    tip: text(head, 'InvoiceTypeCode'),
    tarih: isoDate(text(head, 'IssueDate')),
    saticiUnvan: sup.unvan,
    saticiVkn: sup.vkn,
    aliciUnvan: cus.unvan,
    aliciVkn: cus.vkn,
    paraBirimi: text(head, 'DocumentCurrencyCode') || 'TRY',
    kalemler,
    kdvler,
    araToplam: num(total, 'LineExtensionAmount'),
    iskonto: num(total, 'AllowanceTotalAmount'),
    kdvToplam: num(taxTotal, 'TaxAmount'),
    odenecek: num(total, 'PayableAmount'),
    notlar: blocks(head, 'Note')
      .map((n) => xmlUnescape(cdata(n).replace(/<[^>]+>/g, '')).trim())
      .filter((n) => n && n.length < 300)
      .slice(0, 5),
  };
}
