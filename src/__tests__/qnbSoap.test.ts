import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { unzipSync, zipSync } from 'fflate';
import {
  base64ToBytes,
  buildEnvelope,
  isLoginFault,
  listRequest,
  parseFault,
  parseList,
  detailRequest,
  earsivListInputs,
  EARSIV_OK,
  extractXml,
  mergeLists,
  parseBase64Return,
  parseEarsivList,
  parseEarsivResult,
  parseUbl,
} from '../../supabase/functions/qnb-efatura/soap';
import { EFaturaError, type InvokeFn, listEFaturalar, totalsByCurrency } from '../services/efatura/qnbEfatura';

// Örnek yanıt: QNB'nin donusTipiVersiyon=6.0 yanıtının biçimi (değerler uydurma)
const gelenXml = `<?xml version='1.0' encoding='UTF-8'?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:gelenBelgeleriListeleExtResponse xmlns:ns2="http://service.connector.uut.cs.com.tr/">
<return xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ns2:belgev6"><belgeNo>ABC2026000000001</belgeNo><belgeSiraNo>1</belgeSiraNo><belgeTarihi>20260901</belgeTarihi><belgeTuru>FATURA</belgeTuru><ettn>11111111-1111-1111-1111-111111111111</ettn><gonderenEtiket>urn:mail:defaultgb@ornek.com</gonderenEtiket><gonderenVknTckn>1234567890</gonderenVknTckn><aliciUnvan>Alıcı</aliciUnvan><ekBilgiler><entry><key>x</key><value>y</value></entry></ekBilgiler><saticiUnvan>Örnek Gıda &amp; Ticaret A.Ş.</saticiUnvan><odenecekTutar>1753.14</odenecekTutar><odenecekTutarDovizCinsi>TRY</odenecekTutarDovizCinsi><profileId>TEMELFATURA</profileId></return>
<return xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ns2:belgev6"><belgeNo>ABC2026000000002</belgeNo><belgeTarihi>20260915</belgeTarihi><ettn>22222222-2222-2222-2222-222222222222</ettn><gonderenVknTckn>9876543210</gonderenVknTckn><saticiUnvan>İkinci Ltd. Şti.</saticiUnvan><odenecekTutar>129.00</odenecekTutar><odenecekTutarDovizCinsi>TRY</odenecekTutarDovizCinsi><profileId>TICARIFATURA</profileId></return>
</ns2:gelenBelgeleriListeleExtResponse></S:Body></S:Envelope>`;

const fault = (msg: string) =>
  `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:Fault xmlns:ns2="http://schemas.xmlsoap.org/soap/envelope/"><faultcode>ns2:Server</faultcode><faultstring>${msg}</faultstring></ns2:Fault></S:Body></S:Envelope>`;

describe('QNB SOAP', () => {
  it('zarf: kimlik bilgileri ve parametreler XML-escape edilir', () => {
    const xml = buildEnvelope('gidenBelgeleriListele', { vkn: '1234567890' }, 'a&b', 'p<"x>');
    assert.match(xml, /<wsse:Username>a&amp;b<\/wsse:Username>/);
    assert.match(xml, /<wsse:Password>p&lt;&quot;x&gt;<\/wsse:Password>/);
    assert.match(xml, /<ser:gidenBelgeleriListele><parametreler><vkn>1234567890<\/vkn><\/parametreler>/);
  });

  it('gelen sorgusu tarih aralığını sıra numarasıyla birlikte göndermez ve 6.0 dönüşünü ister', () => {
    const { op, params } = listRequest('gelen', '1234567890', '20260901', '20260930');
    assert.equal(op, 'gelenBelgeleriListeleExt');
    assert.equal(params.sonAlinanBelgeSiraNumarasi, undefined);
    assert.equal(params.donusTipiVersiyon, '6.0');
    assert.equal(params.faturaTarihiBitis, '20260930');
    assert.equal(listRequest('giden', '1', 'a', 'b').op, 'gidenBelgeleriListele');
  });

  it('listeyi çözümler: unvan, tutar, tarih; yeni tarihli üstte', () => {
    const list = parseList(gelenXml, 'gelen');
    assert.equal(list.length, 2);
    assert.equal(list[0]!.unvan, 'İkinci Ltd. Şti.');
    assert.equal(list[0]!.tarih, '2026-09-15');
    assert.equal(list[1]!.unvan, 'Örnek Gıda & Ticaret A.Ş.');
    assert.equal(list[1]!.tutar, 1753.14);
    assert.equal(list[1]!.vkn, '1234567890');
    assert.equal(list[1]!.profil, 'TEMELFATURA');
  });

  it('boş yanıt boş liste', () => {
    const xml = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body><ns2:gidenBelgeleriListeleResponse xmlns:ns2="http://service.connector.uut.cs.com.tr/"/></S:Body></S:Envelope>`;
    assert.deepEqual(parseList(xml, 'giden'), []);
    assert.equal(parseFault(xml), null);
  });

  it('giden: alıcı unvanı yoksa VKN gösterilir', () => {
    const xml = '<return><belgeNo>G1</belgeNo><belgeTarihi>20261001</belgeTarihi><aliciVkn>5555555555</aliciVkn><payableAmount>10.5</payableAmount></return>';
    const [f] = parseList(xml, 'giden');
    assert.equal(f!.unvan, '5555555555');
    assert.equal(f!.tutar, 10.5);
    assert.equal(f!.paraBirimi, 'TRY');
  });

  it('hata: giriş hatası ayırt edilir, parametre hatası giriş hatası sayılmaz', () => {
    assert.equal(parseFault(fault('username.pwd.mismatch')), 'username.pwd.mismatch');
    assert.ok(isLoginFault('username.pwd.mismatch'));
    assert.ok(isLoginFault('Kullanıcı adı veya şifre hatalı'));
    const param = parseFault(fault('sonAlinanBelgeSiraNumarasi ile birlikte faturaTarihiBaslangic/Bitis parametreleri gönderilemez !'))!;
    assert.equal(isLoginFault(param), false);
    assert.equal(isLoginFault('donusTipiVersiyon parametresi 1.0, 2.0 olabilir'), false);
  });
});

const httpError = (status: number, body: object) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: new Response(JSON.stringify(body), { status }) });

describe('listEFaturalar', () => {
  it('sunucuya yön ve tarihleri gönderir', async () => {
    let sent: Record<string, unknown> | undefined;
    const invoke: InvokeFn = async (name, { body }) => {
      assert.equal(name, 'qnb-efatura');
      sent = body;
      return { data: { faturalar: parseList(gelenXml, 'gelen') }, error: null };
    };
    const { faturalar: list } = await listEFaturalar(invoke, 'gelen', '2026-09-01', '2026-09-30');
    assert.equal(list.length, 2);
    assert.deepEqual(sent, { yon: 'gelen', baslangic: '2026-09-01', bitis: '2026-09-30' });
    assert.deepEqual(totalsByCurrency(list), [{ paraBirimi: 'TRY', toplam: 1882.14 }]);
  });

  it('QNB giriş hatası loginFailed olarak işaretlenir', async () => {
    const invoke: InvokeFn = async () => ({ data: null, error: httpError(502, { code: 'qnb_login', message: 'QNB girişi başarısız: username.pwd.mismatch' }) });
    await assert.rejects(listEFaturalar(invoke, 'gelen', '2026-09-01', '2026-09-30'), (e: unknown) => e instanceof EFaturaError && e.loginFailed && /username/.test(e.message));
  });

  it('diğer hatalar loginFailed değildir', async () => {
    const invoke: InvokeFn = async () => ({ data: null, error: httpError(403, { message: 'Bu hesabın e-faturaları görme yetkisi yok.' }) });
    await assert.rejects(listEFaturalar(invoke, 'giden', '2026-09-01', '2026-09-30'), (e: unknown) => e instanceof EFaturaError && !e.loginFailed && /yetkisi yok/.test(e.message));
  });
});

// ---- e-Arşiv ve fatura detayı ----

const ubl = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
<cbc:ProfileID>TEMELFATURA</cbc:ProfileID><cbc:ID>ABC2026000000001</cbc:ID><cbc:IssueDate>2026-10-28</cbc:IssueDate>
<cbc:Note>Yalnız 1.200,00 TL</cbc:Note><cbc:DocumentCurrencyCode>TRY</cbc:DocumentCurrencyCode>
<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">1234567890</cbc:ID></cac:PartyIdentification><cac:PartyIdentification><cbc:ID schemeID="MERSISNO">0</cbc:ID></cac:PartyIdentification><cac:PartyName><cbc:Name>Örnek &amp; Ticaret A.Ş.</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="TCKN">11111111111</cbc:ID></cac:PartyIdentification><cac:Person><cbc:FirstName>Ali</cbc:FirstName><cbc:FamilyName>Veli</cbc:FamilyName></cac:Person></cac:Party></cac:AccountingCustomerParty>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">200.00</cbc:TaxAmount>
<cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">1000.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">200.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent><cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="TRY">1000.00</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="TRY">1000.00</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="TRY">1200.00</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount currencyID="TRY">0</cbc:AllowanceTotalAmount><cbc:PayableAmount currencyID="TRY">1200.00</cbc:PayableAmount></cac:LegalMonetaryTotal>
<cac:InvoiceLine><cbc:ID>1</cbc:ID><cbc:InvoicedQuantity unitCode="C62">2</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">600.00</cbc:LineExtensionAmount>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">120.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">600.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">120.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent></cac:TaxSubtotal></cac:TaxTotal>
<cac:Item><cbc:Name>Kablo</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">300.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
<cac:InvoiceLine><cbc:ID>2</cbc:ID><cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="TRY">400.00</cbc:LineExtensionAmount>
<cac:TaxTotal><cbc:TaxAmount currencyID="TRY">80.00</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="TRY">400.00</cbc:TaxableAmount><cbc:TaxAmount currencyID="TRY">80.00</cbc:TaxAmount><cbc:Percent>20</cbc:Percent></cac:TaxSubtotal></cac:TaxTotal>
<cac:Item><cbc:Name>Adaptör</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="TRY">400.00</cbc:PriceAmount></cac:Price></cac:InvoiceLine>
</Invoice>`;

describe('fatura detayı (UBL)', () => {
  it('indirme isteği parametreler sarmalı olmadan gider', () => {
    const { op, params } = detailRequest('gelen', '1234567890', '11111111-1111-1111-1111-111111111111');
    assert.equal(op, 'gelenBelgeIndirExt');
    const xml = buildEnvelope(op, params, 'u', 'p', { wrap: false });
    assert.match(xml, /<ser:gelenBelgeIndirExt><vergiTcKimlikNo>1234567890<\/vergiTcKimlikNo><belgeEttn>/);
    assert.match(xml, /<belgeFormati>UBL<\/belgeFormati>/);
    assert.equal(detailRequest('giden', '1', 'x').op, 'gidenBelgeIndirExt');
  });

  it('base64 zip içindeki UBL çözülür', () => {
    const zip = zipSync({ 'fatura.xml': new TextEncoder().encode(ubl) });
    const b64 = Buffer.from(zip).toString('base64');
    const resp = `<S:Envelope><S:Body><ns2:gelenBelgeIndirExtResponse><return>${b64}</return></ns2:gelenBelgeIndirExtResponse></S:Body></S:Envelope>`;
    const xml = extractXml(base64ToBytes(parseBase64Return(resp)!), unzipSync);
    assert.ok(xml.includes('ABC2026000000001'));
    // Zip değilse düz metin
    assert.equal(extractXml(new TextEncoder().encode('<a/>'), unzipSync), '<a/>');
  });

  it('kalemler, KDV ve toplamlar', () => {
    const d = parseUbl(ubl);
    assert.equal(d.belgeNo, 'ABC2026000000001');
    assert.equal(d.tarih, '2026-10-28');
    assert.equal(d.saticiUnvan, 'Örnek & Ticaret A.Ş.');
    assert.equal(d.saticiVkn, '1234567890');
    assert.equal(d.aliciUnvan, 'Ali Veli');
    assert.equal(d.aliciVkn, '11111111111');
    assert.equal(d.kalemler.length, 2);
    assert.deepEqual(d.kalemler[0], { ad: 'Kablo', miktar: 2, birim: 'C62', birimFiyat: 300, tutar: 600, kdvOrani: 20, kdvTutari: 120 });
    assert.deepEqual(d.kdvler, [{ oran: 20, matrah: 1000, tutar: 200 }]);
    assert.equal(d.araToplam, 1000);
    assert.equal(d.kdvToplam, 200);
    assert.equal(d.odenecek, 1200);
    assert.deepEqual(d.notlar, ['Yalnız 1.200,00 TL']);
  });
});

describe('e-Arşiv listesi', () => {
  it('zarf e-Arşiv ad alanını kullanır, input JSON metin olarak gider', () => {
    const [first] = earsivListInputs('1234567890', '2026-10-01', '2026-10-31');
    const xml = buildEnvelope('faturaListeSorgula', { input: JSON.stringify(first) }, 'u', 'p', { earsiv: true });
    assert.match(xml, /xmlns:ser="http:\/\/service\.earsiv\.uut\.cs\.com\.tr\/"/);
    assert.match(xml, /<ser:faturaListeSorgula><input>\{&quot;vkn&quot;:&quot;1234567890&quot;/);
    assert.equal(first!.baslangicTarihi, '20261001');
  });

  it('sonuç kodu, çıktı ve tarih süzmesi', () => {
    const xml = `<S:Envelope><S:Body><ns2:faturaListeSorgulaResponse><return><resultCode>AE00000</resultCode><resultText>Başarılı</resultText></return>
<output><invoiceId>EAR2026000000010</invoiceId><issueDate>2026-10-15</issueDate><payableAmount>2400.00</payableAmount><currency>TRY</currency><receiverName>Müşteri A.Ş.</receiverName><receiverIdentifier>2222222222</receiverIdentifier><uuid>33333333-3333-3333-3333-333333333333</uuid><profileId>EARSIVFATURA</profileId></output>
<output><invoiceId>EAR2026000000011</invoiceId><issueDate>2026-10-20</issueDate><payableAmount>100</payableAmount><receiverName>İptal Ltd.</receiverName><uuid>44444444-4444-4444-4444-444444444444</uuid><iptalTarihi>2026-10-21</iptalTarihi></output>
<output><invoiceId>EAR2026000000001</invoiceId><issueDate>2026-09-30</issueDate><payableAmount>5</payableAmount><uuid>55555555-5555-5555-5555-555555555555</uuid></output>
</ns2:faturaListeSorgulaResponse></S:Body></S:Envelope>`;
    assert.deepEqual(parseEarsivResult(xml), { code: EARSIV_OK, text: 'Başarılı' });
    const list = parseEarsivList(xml, '2026-10-01', '2026-10-31');
    assert.equal(list.length, 2, 'Eylül faturası süzülmeli');
    assert.equal(list[0]!.unvan, 'Müşteri A.Ş.');
    assert.equal(list[0]!.tutar, 2400);
    assert.equal(list[0]!.tur, 'earsiv');
    assert.equal(list[1]!.iptal, true);
    const merged = mergeLists(list, [{ ...list[0]! }]);
    assert.equal(merged.length, 2, 'aynı ETTN bir kez');
    assert.equal(merged[0]!.belgeNo, 'EAR2026000000011', 'yeni tarihli üstte');
  });
});
