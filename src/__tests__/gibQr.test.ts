import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseGibQr } from '../lib/gibQr';

const sample = {
  vkntckn: '3900383669',
  avkntckn: '11111111111',
  senaryo: 'EARSIVFATURA',
  tip: 'SATIS',
  tarih: '2026-09-14',
  no: 'ABC2026000000123',
  ettn: '0f1e2d3c-1111-2222-3333-444455556666',
  parabirimi: 'TRY',
  malhizmettoplam: '1050.00',
  'kdvmatrah(20)': '1000.00',
  'hesaplanankdv(20)': '200.00',
  'kdvmatrah(1)': '50',
  'hesaplanankdv(1)': '0.5',
  vergidahil: '1250.50',
  odenecek: '1250.50',
};

describe('GİB fatura karekodu', () => {
  it('e-Arşiv karekodunu fiş verisine çevirir', () => {
    const d = parseGibQr(JSON.stringify(sample))!;
    assert.deepEqual(d, {
      vkn: '3900383669',
      faturaNo: 'ABC2026000000123',
      tarih: '14.09.2026',
      toplamTutar: 1250.5,
      kdvYuzde1: 0.5,
      kdvYuzde10: 0,
      kdvYuzde20: 200,
      paraBirimi: 'TRY',
      senaryo: 'EARSIVFATURA',
    });
  });
  it('makine biçimindeki "8.475" sekiz virgül dört yüz yetmiş beş okunur (binlik değil)', () => {
    const d = parseGibQr(JSON.stringify({ ...sample, 'hesaplanankdv(20)': '8.475', 'hesaplanankdv(1)': '0', odenecek: '50.85' }))!;
    assert.equal(d.kdvYuzde20, 8.48);
    assert.equal(d.toplamTutar, 50.85);
  });
  it('eski oranlar (18, 8) en yakın güncel dilime; büyük/küçük harf ve boşluklu anahtarlar', () => {
    const d = parseGibQr(
      JSON.stringify({ VKNTCKN: '3900383669', Tarih: '14.09.2023', 'HesaplananKDV (18)': '18', 'hesaplanankdv(8)': '8', VergiDahil: '226' }),
    )!;
    assert.equal(d.kdvYuzde20, 18);
    assert.equal(d.kdvYuzde10, 8);
    assert.equal(d.toplamTutar, 226, 'ödenecek yoksa vergi dahil tutar');
    assert.equal(d.tarih, '14.09.2023');
  });
  it('karekodun önünde/arkasında metin olsa da çözülür', () => assert.ok(parseGibQr(`GIB: ${JSON.stringify(sample)} son`)));
  it('fatura karekodu olmayanlar reddedilir', () => {
    assert.equal(parseGibQr('https://example.com'), null);
    assert.equal(parseGibQr('{bozuk'), null);
    assert.equal(parseGibQr(JSON.stringify({ ...sample, vkntckn: '123' })), null, 'geçersiz VKN');
    assert.equal(parseGibQr(JSON.stringify({ ...sample, tarih: 'dün' })), null, 'tarih yok');
    assert.equal(parseGibQr(JSON.stringify({ ...sample, odenecek: '0' })), null, 'tutar yok');
  });
});
