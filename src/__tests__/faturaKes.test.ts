import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  belgeGonderIstegi,
  earsivOlusturIstegi,
  earsivSonucu,
  faturaNo,
  girisHatasiMi,
  hataMesaji,
  md5,
  mukellefMi,
  utf8,
  zarf,
} from '../../supabase/functions/qnb-fatura-kes/istek';
import {
  EARSIV_GONDERIM_NOTU,
  dogrula,
  hesapla,
  tcknGecerli,
  ublOlustur,
  vknGecerli,
  type FaturaGirdi,
  type Taraf,
} from '../../supabase/functions/qnb-fatura-kes/ubl';
import { FaturaKesError, faturaKes, mukellefSorgula, simdiIstanbul } from '../services/efatura/faturaKes';

const satici: Taraf = { vknTckn: '1234567890', unvan: 'Örnek & Ortak Ltd. Şti.', vergiDairesi: 'Kadıköy', il: 'İstanbul', ilce: 'Kadıköy', adres: 'Moda Cd. 1' };
const sirket: Taraf = { vknTckn: '9876543217', unvan: 'Alıcı A.Ş.', vergiDairesi: 'Beşiktaş', il: 'İstanbul', ilce: 'Beşiktaş' };
const sahis: Taraf = { vknTckn: '10000000146', ad: 'Ayşe', soyad: 'Yılmaz', il: 'Ankara', ilce: 'Çankaya' };

const fatura = (o: Partial<FaturaGirdi> = {}): FaturaGirdi => ({
  tur: 'efatura',
  senaryo: 'TEMELFATURA',
  ettn: '0f8fad5b-d9cb-469f-a165-70867728950e',
  tarih: '2026-11-24',
  saat: '10:30:00',
  alici: sirket,
  kalemler: [
    { ad: 'Danışmanlık', miktar: 3, birim: 'HUR', birimFiyat: 333.33, kdvOrani: 20 },
    { ad: 'Kitap', miktar: 2, birim: 'C62', birimFiyat: 49.995, kdvOrani: 10, iskontoOrani: 10 },
  ],
  ...o,
});

describe('fatura hesabı', () => {
  it('satırlar kuruşa yuvarlanır, toplamlar satırların toplamıdır', () => {
    const t = hesapla(fatura().kalemler);
    assert.deepEqual(t.kalemler[0], { brut: 999.99, iskonto: 0, net: 999.99, kdv: 200 });
    // 2 × 49,995 = 99,99; %10 iskonto = 10,00 (9,999 → 10,00); net 89,99; KDV %10 = 9,00
    assert.deepEqual(t.kalemler[1], { brut: 99.99, iskonto: 10, net: 89.99, kdv: 9 });
    assert.equal(t.matrah, 1089.98);
    assert.equal(t.kdv, 209);
    assert.equal(t.odenecek, 1298.98);
    assert.deepEqual(t.kdvSatirlari, [
      { oran: 10, matrah: 89.99, kdv: 9 },
      { oran: 20, matrah: 999.99, kdv: 200 },
    ]);
  });

  it('kayan nokta hatası yok (0,1 + 0,2)', () => {
    const t = hesapla([
      { ad: 'a', miktar: 1, birim: 'C62', birimFiyat: 0.1, kdvOrani: 0 },
      { ad: 'b', miktar: 1, birim: 'C62', birimFiyat: 0.2, kdvOrani: 0 },
    ]);
    assert.equal(t.odenecek, 0.3);
  });
});

describe('kimlik numaraları', () => {
  it('VKN ve TCKN kontrol haneleri', () => {
    assert.ok(vknGecerli('1234567890'));
    assert.ok(!vknGecerli('1234567891'));
    assert.ok(tcknGecerli('10000000146'));
    assert.ok(!tcknGecerli('10000000147'));
    assert.ok(tcknGecerli('11111111111'));
    assert.ok(!tcknGecerli('01234567890'));
  });
});

describe('denetim', () => {
  it('doğru fatura hatasız', () => {
    assert.deepEqual(dogrula(fatura(), satici), []);
    assert.deepEqual(dogrula(fatura({ tur: 'earsiv', alici: sahis }), satici), []);
  });

  it('eksik ve hatalı alanlar anlaşılır mesajla bildirilir', () => {
    const h = dogrula(
      fatura({
        alici: { vknTckn: '123', il: '', ilce: '' },
        kalemler: [{ ad: '', miktar: 0, birim: 'XX', birimFiyat: -1, kdvOrani: 18 }],
      }),
      satici,
    );
    assert.ok(h.some((m) => m.includes('10 haneli vergi numarası')));
    assert.ok(h.some((m) => m.includes('1. satır: mal/hizmet adı')));
    assert.ok(h.some((m) => m.includes('KDV oranı')));
    assert.ok(h.some((m) => m.includes('birim seçilmeli')));
  });

  it('kimliği bilinmeyen alıcıya e-Fatura kesilemez', () => {
    const h = dogrula(fatura({ alici: { ...sahis, vknTckn: '11111111111' } }), satici);
    assert.ok(h.some((m) => m.includes('e-Arşiv seçin')));
  });
});

describe('UBL-TR', () => {
  it('e-Fatura: senaryo, numara, taraflar ve toplamlar', () => {
    const xml = ublOlustur(fatura(), satici, 'ABC2026000000001');
    assert.match(xml, /<cbc:CustomizationID>TR1\.2<\/cbc:CustomizationID><cbc:ProfileID>TEMELFATURA<\/cbc:ProfileID><cbc:ID>ABC2026000000001<\/cbc:ID>/);
    assert.match(xml, /<cbc:UUID>0F8FAD5B-D9CB-469F-A165-70867728950E<\/cbc:UUID>/);
    assert.match(xml, /<cbc:InvoiceTypeCode>SATIS<\/cbc:InvoiceTypeCode>/);
    assert.match(xml, /Örnek &amp; Ortak Ltd\. Şti\./);
    assert.ok(!xml.includes(EARSIV_GONDERIM_NOTU));
    assert.match(xml, /<cac:AccountingCustomerParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="VKN">9876543217</);
    assert.match(xml, /<cbc:PayableAmount currencyID="TRY">1298\.98<\/cbc:PayableAmount>/);
    assert.match(xml, /<cbc:AllowanceTotalAmount currencyID="TRY">10\.00</);
    assert.match(xml, /<cbc:LineCountNumeric>2<\/cbc:LineCountNumeric>/);
    assert.match(xml, /<cbc:InvoicedQuantity unitCode="HUR">3<\/cbc:InvoicedQuantity>/);
    assert.match(xml, /<cbc:MultiplierFactorNumeric>0\.1<\/cbc:MultiplierFactorNumeric>/);
    // Açılan her etiket doğru sırayla kapanır (basit iyi biçim denetimi)
    const yigin: string[] = [];
    for (const m of xml.replace(/<\?xml[^>]*\?>/, '').matchAll(/<(\/?)([\w:]+)[^>]*?(\/?)>/g)) {
      if (m[3]) continue;
      if (m[1]) assert.equal(yigin.pop(), m[2]);
      else yigin.push(m[2]!);
    }
    assert.deepEqual(yigin, []);
  });

  it('e-Arşiv şahsa: EARSIVFATURA, TCKN + Person, gönderim notu, boş numara', () => {
    const xml = ublOlustur(fatura({ tur: 'earsiv', alici: sahis, not: 'Teşekkürler <3' }), satici);
    assert.match(xml, /<cbc:ProfileID>EARSIVFATURA<\/cbc:ProfileID><cbc:ID><\/cbc:ID>/);
    assert.match(xml, /<cbc:ID schemeID="TCKN">10000000146<\/cbc:ID>/);
    assert.match(xml, /<cac:Person><cbc:FirstName>Ayşe<\/cbc:FirstName><cbc:FamilyName>Yılmaz<\/cbc:FamilyName><\/cac:Person>/);
    assert.match(xml, /<cbc:Note>Teşekkürler &lt;3<\/cbc:Note><cbc:Note>Gönderim Şekli: ELEKTRONIK<\/cbc:Note>/);
  });

  it('%0 KDV satırında muafiyet kodu yazılır', () => {
    const xml = ublOlustur(fatura({ kalemler: [{ ad: 'x', miktar: 1, birim: 'C62', birimFiyat: 10, kdvOrani: 0 }] }), satici, 'ABC2026000000001');
    assert.match(xml, /<cbc:Percent>0<\/cbc:Percent><cac:TaxCategory><cbc:TaxExemptionReasonCode>351</);
  });
});

describe('QNB istekleri', () => {
  it('MD5 Node ile aynı', () => {
    for (const s of ['', 'abc', 'Türkçe ğüşiöç'.repeat(50), 'x'.repeat(1000)]) {
      assert.equal(md5(utf8(s)), createHash('md5').update(s, 'utf8').digest('hex'));
    }
  });

  it('belgeGonder: veri base64, hash XML’in MD5’i', () => {
    const xml = ublOlustur(fatura(), satici, 'ABC2026000000001');
    const { op, govde } = belgeGonderIstegi('1234567890', fatura().ettn, xml);
    assert.equal(op, 'belgeGonder');
    const veri = /<veri>([^<]+)<\/veri>/.exec(govde)![1]!;
    assert.equal(Buffer.from(veri, 'base64').toString('utf8'), xml);
    assert.match(govde, new RegExp(`<belgeHash>${createHash('md5').update(xml).digest('hex')}</belgeHash>`));
    assert.match(govde, /<belgeTuru>FATURA_UBL<\/belgeTuru>/);
    assert.match(zarf(op, govde, 'u', 'p'), /<ser:belgeGonder><vergiTcKimlikNo>1234567890</);
  });

  it('e-Arşiv: input JSON ve fatura içeriği', () => {
    const { op, govde } = earsivOlusturIstegi('1234567890', 'id-1', '<x/>', 'EAR');
    assert.equal(op, 'faturaOlustur');
    const input = JSON.parse(/<input>([^<]+)<\/input>/.exec(govde)![1]!.replace(/&quot;/g, '"'));
    assert.deepEqual(input, { donenBelgeFormati: 9, islemId: 'id-1', vkn: '1234567890', sube: 'DFLT', kasa: 'DFLT', numaraVerilsinMi: 1, faturaSeri: 'EAR' });
    assert.match(govde, /<fatura><belgeFormati>UBL<\/belgeFormati><belgeIcerigi>PHgvPg==<\/belgeIcerigi><\/fatura>/);
    assert.match(zarf(op, govde, 'u', 'p', true), /xmlns:ser="http:\/\/service\.earsiv\.uut\.cs\.com\.tr\/"/);
  });

  it('yanıtlar çözümlenir', () => {
    assert.equal(mukellefMi('<S:Body><ns2:r><return>true</return></ns2:r></S:Body>'), true);
    assert.equal(mukellefMi('<return>false</return>'), false);
    assert.equal(mukellefMi('<return></return>'), null);
    assert.equal(faturaNo('<return>ABC2026000000012</return>'), 'ABC2026000000012');
    assert.equal(faturaNo('<return>hata</return>'), null);
    const s = earsivSonucu(
      '<return><resultCode>AE00000</resultCode><resultText>Başarılı</resultText><resultExtra><entry><key>faturaNo</key><value>EAR2026000000003</value></entry><entry><key>uuid</key><value>u-1</value></entry></resultExtra></return>',
    );
    assert.deepEqual(s, { kod: 'AE00000', metin: 'Başarılı', ek: { faturaNo: 'EAR2026000000003', uuid: 'u-1' } });
    assert.equal(hataMesaji('<faultstring>Kullanıcı adı veya şifre hatalı</faultstring>'), 'Kullanıcı adı veya şifre hatalı');
    assert.ok(girisHatasiMi('Kullanıcı adı veya şifre hatalı'));
    assert.ok(!girisHatasiMi('Fatura numarası daha önce kullanılmış'));
  });
});

describe('istemci', () => {
  it('sunucu hatasını ve hata listesini taşır', async () => {
    const invoke = async () => ({
      data: null,
      error: Object.assign(new Error('x'), { context: { status: 400, json: async () => ({ message: 'Alıcı: il gerekli.', hatalar: ['Alıcı: il gerekli.'] }) } }),
    });
    await assert.rejects(
      () => faturaKes(invoke, fatura(), satici, 'ABC', 'test'),
      (e: unknown) => e instanceof FaturaKesError && e.hatalar.length === 1 && e.message === 'Alıcı: il gerekli.',
    );
  });

  it('onay ve ortam her gönderimde iletilir', async () => {
    let govde: Record<string, unknown> = {};
    const invoke = async (_n: string, o: { body: Record<string, unknown> }) => {
      govde = o.body;
      return { data: { sonuc: { tur: 'efatura', ettn: 'e', belgeNo: 'ABC2026000000001', durum: 'ok', ortam: 'test' } }, error: null };
    };
    const r = await faturaKes(invoke, fatura(), satici, 'ABC', 'test');
    assert.equal(r.belgeNo, 'ABC2026000000001');
    assert.equal(govde.onay, true);
    assert.equal(govde.ortam, 'test');
    assert.equal(govde.islem, 'kes');
  });

  it('mükellef sorgusu', async () => {
    assert.equal(await mukellefSorgula(async () => ({ data: { efatura: true }, error: null }), '1234567890'), true);
  });

  it('Türkiye saati', () => {
    assert.deepEqual(simdiIstanbul(Date.UTC(2026, 10, 24, 22, 15, 5)), { tarih: '2026-11-25', saat: '01:15:05' });
  });
});
