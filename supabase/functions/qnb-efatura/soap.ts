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

function isoDate(yyyymmdd: string | undefined): string {
  const s = (yyyymmdd ?? '').replace(/\D/g, '');
  return s.length >= 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '';
}

export function toEFatura(r: Record<string, string>, yon: Yon): EFatura {
  const vkn = (yon === 'gelen' ? r.gonderenVknTckn : r.aliciVkn) ?? '';
  const unvan = (yon === 'gelen' ? r.saticiUnvan || r.gonderenIsim : r.aliciUnvan) || vkn || 'Bilinmeyen firma';
  const tutar = Number(r.odenecekTutar ?? r.payableAmount ?? '');
  return {
    ettn: r.ettn ?? '',
    belgeNo: r.belgeNo ?? '',
    tarih: isoDate(r.belgeTarihi),
    unvan,
    vkn,
    tutar: Number.isFinite(tutar) ? tutar : 0,
    paraBirimi: r.odenecekTutarDovizCinsi || r.dovizCinsi || 'TRY',
    profil: r.profileId ?? r.faturaSenaryo ?? '',
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

/** Denenecek e-Arşiv liste girdileri (tarihler YYYY-MM-DD) */
export function earsivListInputs(vkn: string, baslangic: string, bitis: string): Record<string, string>[] {
  const c = (d: string) => d.replace(/-/g, '');
  return [
    { vkn, baslangicTarihi: c(baslangic), bitisTarihi: c(bitis) },
    { vkn, baslangicTarihi: baslangic, bitisTarihi: bitis },
    { vkn, faturaBaslangicTarihi: c(baslangic), faturaBitisTarihi: c(bitis) },
    { vkn, sube: 'DFLT', kasa: 'DFLT', baslangicTarihi: c(baslangic), bitisTarihi: c(bitis) },
  ];
}

/** e-Arşiv sonuç kodu ve metni (<return><resultCode>…) */
export function parseEarsivResult(xml: string): { code: string; text: string } {
  const r = parseReturns(xml)[0] ?? {};
  return { code: r.resultCode ?? '', text: r.resultText ?? '' };
}

export const EARSIV_OK = 'AE00000';

export function earsivToEFatura(r: Record<string, string>): EFatura {
  const tutar = Number(r.payableAmount ?? r.toplamTutar ?? '');
  const vkn = r.receiverIdentifier ?? '';
  return {
    ettn: r.uuid ?? '',
    belgeNo: r.invoiceId ?? r.yerelFaturaNo ?? '',
    tarih: isoDate(r.issueDate || r.faturaZamani || r.duzenlenmeZamani),
    unvan: r.receiverName || r.receiverIdentifierTxt || vkn || 'Bilinmeyen alıcı',
    vkn,
    tutar: Number.isFinite(tutar) ? tutar : 0,
    paraBirimi: r.currency || 'TRY',
    profil: r.profileId || 'EARSIVFATURA',
    tur: 'earsiv',
    iptal: !!r.iptalTarihi,
  };
}

/** faturaListeSorgula yanıtındaki <output> öğeleri; aralık dışındakiler atılır */
export function parseEarsivList(xml: string, baslangic: string, bitis: string): EFatura[] {
  return parseReturns(xml, 'output')
    .map(earsivToEFatura)
    .filter((f) => !f.tarih || (f.tarih >= baslangic && f.tarih <= bitis));
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

export function detailRequest(yon: Yon, vkn: string, ettn: string): { op: string; params: Record<string, string> } {
  return {
    op: yon === 'gelen' ? 'gelenBelgeIndirExt' : 'gidenBelgeIndirExt',
    params: { vergiTcKimlikNo: vkn, belgeEttn: ettn, belgeTuru: 'FATURA', belgeFormati: 'UBL' },
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

/** İndirilen belgeden UBL XML metni: zip ise içindeki .xml, değilse düz metin */
export function extractXml(bytes: Uint8Array, unzip: (b: Uint8Array) => Record<string, Uint8Array>): string {
  const dec = new TextDecoder('utf-8');
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzip(bytes);
    const name = Object.keys(files).find((n) => /\.xml$/i.test(n)) ?? Object.keys(files)[0];
    if (!name) throw new Error('İndirilen arşiv boş.');
    return dec.decode(files[name]);
  }
  return dec.decode(bytes);
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
function text(xml: string, tag: string): string {
  return xmlUnescape(block(xml, tag).replace(/<[^>]+>/g, '')).trim();
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
      .map((n) => xmlUnescape(n.replace(/<[^>]+>/g, '')).trim())
      .filter((n) => n && n.length < 300)
      .slice(0, 5),
  };
}
