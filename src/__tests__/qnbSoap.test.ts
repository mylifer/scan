import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildEnvelope, isLoginFault, listRequest, parseFault, parseList } from '../../supabase/functions/qnb-efatura/soap';
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
    const list = await listEFaturalar(invoke, 'gelen', '2026-09-01', '2026-09-30');
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
