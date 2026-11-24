// Fatura kesme: tutar hesabı, girdi denetimi ve UBL-TR 1.2 fatura XML'i.
// Hiçbir şey import etmez: hem Deno'daki sunucu fonksiyonu (qnb-fatura-kes) hem web (formdaki canlı toplamlar)
// hem de kök birim testleri (src/__tests__/faturaKes.test.ts) aynı dosyayı kullanır. Böylece ekranda görülen
// toplam ile QNB'ye giden toplam aynı koddan çıkar.
//
// Kapsam (ilk adım): SATIS tipinde, TL, KDV %0 / %1 / %10 / %20. Tevkifat, istisna, iade ve döviz yok.

export type FaturaTuru = 'efatura' | 'earsiv';
/** e-Fatura senaryosu (e-Arşiv her zaman EARSIVFATURA) */
export type Senaryo = 'TEMELFATURA' | 'TICARIFATURA';

export const KDV_ORANLARI = [0, 1, 10, 20] as const;

/** UN/ECE birim kodları (GİB kod listesi) */
export const BIRIMLER: { kod: string; ad: string }[] = [
  { kod: 'C62', ad: 'Adet' },
  { kod: 'HUR', ad: 'Saat' },
  { kod: 'DAY', ad: 'Gün' },
  { kod: 'MON', ad: 'Ay' },
  { kod: 'KGM', ad: 'Kilogram' },
  { kod: 'LTR', ad: 'Litre' },
  { kod: 'MTR', ad: 'Metre' },
  { kod: 'MTK', ad: 'Metrekare' },
  { kod: 'SET', ad: 'Set' },
  { kod: 'PA', ad: 'Paket' },
];

/** %0 KDV'li SATIS satırları için GİB muafiyet kodu: "KDV - İstisna Olmayan Diğer" */
export const KDV0_KODU = '351';
export const KDV0_SEBEP = 'KDV - İstisna Olmayan Diğer';

/** Adı bilinmeyen nihai tüketici için GİB'in kabul ettiği TCKN */
export const BILINMEYEN_TCKN = '11111111111';

export interface Taraf {
  /** 10 hane VKN (şirket) ya da 11 hane TCKN (şahıs) */
  vknTckn: string;
  /** Şirket unvanı (VKN) */
  unvan?: string;
  /** Şahıs adı ve soyadı (TCKN) */
  ad?: string;
  soyad?: string;
  vergiDairesi?: string;
  adres?: string;
  ilce: string;
  il: string;
  ulke?: string;
  eposta?: string;
  telefon?: string;
}

export interface Kalem {
  ad: string;
  miktar: number;
  /** BIRIMLER kodu */
  birim: string;
  /** KDV hariç birim fiyat (TL) */
  birimFiyat: number;
  /** 0, 1, 10, 20 */
  kdvOrani: number;
  /** İskonto yüzdesi (0–100), isteğe bağlı */
  iskontoOrani?: number;
}

export interface FaturaGirdi {
  tur: FaturaTuru;
  /** e-Fatura için; e-Arşiv'de yok sayılır */
  senaryo?: Senaryo;
  /** ETTN (UUID). İstemci formu açarken üretir: aynı fatura iki kez gönderilirse QNB ikincisini reddeder. */
  ettn: string;
  /** YYYY-MM-DD */
  tarih: string;
  /** HH:MM:SS */
  saat: string;
  alici: Taraf;
  kalemler: Kalem[];
  /** Faturaya yazılacak serbest not */
  not?: string;
}

export interface KalemSonuc {
  brut: number;
  iskonto: number;
  /** KDV matrahı (LineExtensionAmount) */
  net: number;
  kdv: number;
}

export interface KdvSatiri {
  oran: number;
  matrah: number;
  kdv: number;
}

export interface Toplamlar {
  kalemler: KalemSonuc[];
  /** İskonto öncesi mal/hizmet toplamı */
  brut: number;
  iskonto: number;
  /** KDV matrahı (iskonto sonrası) */
  matrah: number;
  kdvSatirlari: KdvSatiri[];
  kdv: number;
  /** Ödenecek (KDV dahil) */
  odenecek: number;
}

/** Kuruşa çevirir (kayan nokta hatası olmadan yuvarlar) */
const kurus = (tl: number) => Math.round(tl * 100 + (tl >= 0 ? 1e-7 : -1e-7));
const tl = (k: number) => k / 100;

/** Satır ve fatura toplamları. Her satır kuruşa yuvarlanır, toplamlar yuvarlanmış satırların toplamıdır. */
export function hesapla(kalemler: Kalem[]): Toplamlar {
  const sonuc: KalemSonuc[] = [];
  const oranlar = new Map<number, { matrah: number; kdv: number }>();
  let brut = 0, iskonto = 0, matrah = 0, kdv = 0;
  for (const k of kalemler) {
    const b = kurus((Number(k.miktar) || 0) * (Number(k.birimFiyat) || 0));
    const i = Math.round((b * (Number(k.iskontoOrani) || 0)) / 100);
    const n = b - i;
    const v = Math.round((n * (Number(k.kdvOrani) || 0)) / 100);
    sonuc.push({ brut: tl(b), iskonto: tl(i), net: tl(n), kdv: tl(v) });
    brut += b; iskonto += i; matrah += n; kdv += v;
    const o = oranlar.get(k.kdvOrani) ?? { matrah: 0, kdv: 0 };
    o.matrah += n; o.kdv += v;
    oranlar.set(k.kdvOrani, o);
  }
  return {
    kalemler: sonuc,
    brut: tl(brut),
    iskonto: tl(iskonto),
    matrah: tl(matrah),
    kdvSatirlari: [...oranlar.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([oran, o]) => ({ oran, matrah: tl(o.matrah), kdv: tl(o.kdv) })),
    kdv: tl(kdv),
    odenecek: tl(matrah + kdv),
  };
}

const ETTN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EPOSTA_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** VKN'nin GİB kontrol hanesi doğru mu (10 hane) */
export function vknGecerli(v: string): boolean {
  if (!/^\d{10}$/.test(v)) return false;
  let t = 0;
  for (let i = 0; i < 9; i++) {
    const x = (Number(v[i]) + 9 - i) % 10;
    let y = (x * 2 ** (9 - i)) % 9;
    if (x !== 0 && y === 0) y = 9;
    t += y;
  }
  return (10 - (t % 10)) % 10 === Number(v[9]);
}

/** TCKN'nin kontrol haneleri doğru mu (11 hane; 11111111111 kabul edilir) */
export function tcknGecerli(v: string): boolean {
  if (v === BILINMEYEN_TCKN) return true;
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = [...v].map(Number);
  const tek = d[0]! + d[2]! + d[4]! + d[6]! + d[8]!;
  const cift = d[1]! + d[3]! + d[5]! + d[7]!;
  if ((((tek * 7 - cift) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

export const sahisMi = (t: Taraf) => t.vknTckn.length === 11;

function tarafHatalari(t: Taraf, kim: string): string[] {
  const h: string[] = [];
  const no = (t.vknTckn ?? '').trim();
  if (no.length === 10) {
    if (!vknGecerli(no)) h.push(`${kim}: vergi numarası (VKN) hatalı görünüyor.`);
    if (!t.unvan?.trim()) h.push(`${kim}: unvan gerekli.`);
    if (!t.vergiDairesi?.trim()) h.push(`${kim}: vergi dairesi gerekli.`);
  } else if (no.length === 11) {
    if (!tcknGecerli(no)) h.push(`${kim}: T.C. kimlik numarası hatalı görünüyor.`);
    if (!t.ad?.trim() || !t.soyad?.trim()) h.push(`${kim}: ad ve soyad gerekli.`);
  } else {
    h.push(`${kim}: 10 haneli vergi numarası ya da 11 haneli T.C. kimlik numarası girin.`);
  }
  if (!t.il?.trim()) h.push(`${kim}: il gerekli.`);
  if (!t.ilce?.trim()) h.push(`${kim}: ilçe gerekli.`);
  if (t.eposta?.trim() && !EPOSTA_RE.test(t.eposta.trim())) h.push(`${kim}: e-posta adresi geçersiz.`);
  return h;
}

/** Göndermeden önce denetim: boş dizi = sorun yok. Mesajlar kullanıcıya gösterilir. */
export function dogrula(g: FaturaGirdi, satici: Taraf): string[] {
  const h: string[] = [];
  if (g.tur !== 'efatura' && g.tur !== 'earsiv') h.push('Fatura türü seçilmeli.');
  if (!ETTN_RE.test(g.ettn ?? '')) h.push('Fatura kimliği (ETTN) geçersiz; formu yenileyin.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(g.tarih ?? '') || Number.isNaN(Date.parse(g.tarih))) h.push('Fatura tarihi geçersiz.');
  if (!/^\d{2}:\d{2}:\d{2}$/.test(g.saat ?? '')) h.push('Fatura saati geçersiz.');
  h.push(...tarafHatalari(satici, 'Satıcı (sizin bilgileriniz)'));
  h.push(...tarafHatalari(g.alici, 'Alıcı'));
  if (g.tur === 'efatura' && sahisMi(g.alici) && g.alici.vknTckn === BILINMEYEN_TCKN) {
    h.push('e-Fatura, kimliği bilinmeyen alıcıya kesilemez; e-Arşiv seçin.');
  }
  if (!g.kalemler?.length) h.push('En az bir satır (mal/hizmet) ekleyin.');
  if ((g.kalemler?.length ?? 0) > 200) h.push('En fazla 200 satır eklenebilir.');
  g.kalemler?.forEach((k, i) => {
    const s = `${i + 1}. satır`;
    if (!k.ad?.trim()) h.push(`${s}: mal/hizmet adı gerekli.`);
    if (!(k.miktar > 0)) h.push(`${s}: miktar sıfırdan büyük olmalı.`);
    if (!(k.birimFiyat > 0)) h.push(`${s}: birim fiyat sıfırdan büyük olmalı.`);
    if (!(KDV_ORANLARI as readonly number[]).includes(k.kdvOrani)) h.push(`${s}: KDV oranı %0, %1, %10 ya da %20 olmalı.`);
    if (!BIRIMLER.some((b) => b.kod === k.birim)) h.push(`${s}: birim seçilmeli.`);
    const io = k.iskontoOrani ?? 0;
    if (!(io >= 0 && io < 100)) h.push(`${s}: iskonto %0 ile %99 arasında olmalı.`);
  });
  if (!h.length && !(hesapla(g.kalemler).odenecek > 0)) h.push('Fatura toplamı sıfırdan büyük olmalı.');
  if ((g.not ?? '').length > 500) h.push('Not en fazla 500 karakter olabilir.');
  return h;
}

export function xmlKac(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const para = (n: number) => n.toFixed(2);
/** Miktar: gereksiz sıfırlar olmadan, en çok 4 ondalık */
const miktarYaz = (n: number) => String(Math.round(n * 10000) / 10000);
const e = (ad: string, deger: string | undefined) => (deger?.trim() ? `<cbc:${ad}>${xmlKac(deger.trim())}</cbc:${ad}>` : '');
const tutar = (ad: string, n: number) => `<cbc:${ad} currencyID="TRY">${para(n)}</cbc:${ad}>`;

function party(t: Taraf): string {
  const no = t.vknTckn.trim();
  const sahis = sahisMi(t);
  const ad = sahis ? `${t.ad ?? ''} ${t.soyad ?? ''}`.trim() : (t.unvan ?? '').trim();
  return (
    '<cac:Party>' +
    `<cac:PartyIdentification><cbc:ID schemeID="${sahis ? 'TCKN' : 'VKN'}">${no}</cbc:ID></cac:PartyIdentification>` +
    `<cac:PartyName><cbc:Name>${xmlKac(ad)}</cbc:Name></cac:PartyName>` +
    '<cac:PostalAddress>' +
    e('StreetName', t.adres) +
    e('CitySubdivisionName', t.ilce) +
    e('CityName', t.il) +
    `<cac:Country><cbc:Name>${xmlKac(t.ulke?.trim() || 'Türkiye')}</cbc:Name></cac:Country>` +
    '</cac:PostalAddress>' +
    (t.vergiDairesi?.trim() ? `<cac:PartyTaxScheme><cac:TaxScheme>${e('Name', t.vergiDairesi)}</cac:TaxScheme></cac:PartyTaxScheme>` : '') +
    (t.telefon?.trim() || t.eposta?.trim() ? `<cac:Contact>${e('Telephone', t.telefon)}${e('ElectronicMail', t.eposta)}</cac:Contact>` : '') +
    (sahis ? `<cac:Person>${e('FirstName', t.ad)}${e('FamilyName', t.soyad)}</cac:Person>` : '') +
    '</cac:Party>'
  );
}

function vergiAlt(matrah: number, kdv: number, oran: number): string {
  return (
    '<cac:TaxSubtotal>' +
    tutar('TaxableAmount', matrah) +
    tutar('TaxAmount', kdv) +
    `<cbc:Percent>${oran}</cbc:Percent>` +
    '<cac:TaxCategory>' +
    (oran === 0 ? `<cbc:TaxExemptionReasonCode>${KDV0_KODU}</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>${xmlKac(KDV0_SEBEP)}</cbc:TaxExemptionReason>` : '') +
    '<cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme>' +
    '</cac:TaxCategory>' +
    '</cac:TaxSubtotal>'
  );
}

/** e-Arşiv faturalarında GİB'in istediği not */
export const EARSIV_GONDERIM_NOTU = 'Gönderim Şekli: ELEKTRONIK';

/**
 * UBL-TR 1.2 fatura XML'i. `belgeNo` boşsa (e-Arşiv'de QNB numara verir) cbc:ID boş kalır.
 * İmza eklenmez: QNB, faturayı kendi mali mührüyle imzalar (UBLExtensions bu yüzden boş).
 */
export function ublOlustur(g: FaturaGirdi, satici: Taraf, belgeNo = ''): string {
  const t = hesapla(g.kalemler);
  const profil = g.tur === 'earsiv' ? 'EARSIVFATURA' : (g.senaryo ?? 'TEMELFATURA');
  const notlar = [g.not?.trim(), g.tur === 'earsiv' ? EARSIV_GONDERIM_NOTU : ''].filter(Boolean) as string[];
  const saticiNo = satici.vknTckn.trim();

  const satirlar = g.kalemler
    .map((k, i) => {
      const s = t.kalemler[i]!;
      return (
        '<cac:InvoiceLine>' +
        `<cbc:ID>${i + 1}</cbc:ID>` +
        `<cbc:InvoicedQuantity unitCode="${xmlKac(k.birim)}">${miktarYaz(k.miktar)}</cbc:InvoicedQuantity>` +
        tutar('LineExtensionAmount', s.net) +
        (s.iskonto > 0
          ? '<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator>' +
            `<cbc:MultiplierFactorNumeric>${(k.iskontoOrani ?? 0) / 100}</cbc:MultiplierFactorNumeric>` +
            tutar('Amount', s.iskonto) +
            tutar('BaseAmount', s.brut) +
            '</cac:AllowanceCharge>'
          : '') +
        `<cac:TaxTotal>${tutar('TaxAmount', s.kdv)}${vergiAlt(s.net, s.kdv, k.kdvOrani)}</cac:TaxTotal>` +
        `<cac:Item><cbc:Name>${xmlKac(k.ad.trim())}</cbc:Name></cac:Item>` +
        `<cac:Price>${tutar('PriceAmount', k.birimFiyat)}</cac:Price>` +
        '</cac:InvoiceLine>'
      );
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"' +
    ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
    ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"' +
    ' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">' +
    '<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>' +
    '<cbc:UBLVersionID>2.1</cbc:UBLVersionID>' +
    '<cbc:CustomizationID>TR1.2</cbc:CustomizationID>' +
    `<cbc:ProfileID>${profil}</cbc:ProfileID>` +
    `<cbc:ID>${xmlKac(belgeNo)}</cbc:ID>` +
    '<cbc:CopyIndicator>false</cbc:CopyIndicator>' +
    `<cbc:UUID>${g.ettn.toUpperCase()}</cbc:UUID>` +
    `<cbc:IssueDate>${g.tarih}</cbc:IssueDate>` +
    `<cbc:IssueTime>${g.saat}</cbc:IssueTime>` +
    '<cbc:InvoiceTypeCode>SATIS</cbc:InvoiceTypeCode>' +
    notlar.map((n) => `<cbc:Note>${xmlKac(n)}</cbc:Note>`).join('') +
    '<cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>' +
    `<cbc:LineCountNumeric>${g.kalemler.length}</cbc:LineCountNumeric>` +
    '<cac:Signature>' +
    `<cbc:ID schemeID="VKN_TCKN">${saticiNo}</cbc:ID>` +
    `<cac:SignatoryParty><cac:PartyIdentification><cbc:ID schemeID="${sahisMi(satici) ? 'TCKN' : 'VKN'}">${saticiNo}</cbc:ID></cac:PartyIdentification>` +
    `<cac:PostalAddress>${e('CitySubdivisionName', satici.ilce)}${e('CityName', satici.il)}<cac:Country><cbc:Name>${xmlKac(satici.ulke?.trim() || 'Türkiye')}</cbc:Name></cac:Country></cac:PostalAddress>` +
    '</cac:SignatoryParty>' +
    '<cac:DigitalSignatureAttachment><cac:ExternalReference><cbc:URI>#Signature</cbc:URI></cac:ExternalReference></cac:DigitalSignatureAttachment>' +
    '</cac:Signature>' +
    `<cac:AccountingSupplierParty>${party(satici)}</cac:AccountingSupplierParty>` +
    `<cac:AccountingCustomerParty>${party(g.alici)}</cac:AccountingCustomerParty>` +
    `<cac:TaxTotal>${tutar('TaxAmount', t.kdv)}${t.kdvSatirlari.map((s) => vergiAlt(s.matrah, s.kdv, s.oran)).join('')}</cac:TaxTotal>` +
    '<cac:LegalMonetaryTotal>' +
    tutar('LineExtensionAmount', t.matrah) +
    tutar('TaxExclusiveAmount', t.matrah) +
    tutar('TaxInclusiveAmount', t.odenecek) +
    tutar('AllowanceTotalAmount', t.iskonto) +
    tutar('PayableAmount', t.odenecek) +
    '</cac:LegalMonetaryTotal>' +
    satirlar +
    '</Invoice>'
  );
}
