import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleanFisNo, isLikelyDuplicate, isValidTckn, isValidVkn, parseTags, sameFisNo, taxIdError, taxIdWarning } from '../lib/receiptExtras';

describe('VKN / TCKN', () => {
  it('geçerli VKN kontrol hanesi tutar (GİB test VKN\'si ve 1234567890)', () => {
    assert.ok(isValidVkn('3900383669'));
    assert.ok(isValidVkn('1234567890'));
  });
  it('tek rakamı değişen VKN reddedilir (okuma hatası yakalanır)', () => {
    const base = '3900383669';
    for (let i = 0; i < 10; i++) {
      const d = (Number(base[i]) + 1) % 10;
      assert.equal(isValidVkn(base.slice(0, i) + d + base.slice(i + 1)), false, `hane ${i}`);
    }
    assert.equal(isValidVkn('390038366'), false);
  });
  it('TCKN kontrol haneleri', () => {
    assert.ok(isValidTckn('10000000146'));
    assert.equal(isValidTckn('10000000147'), false);
    assert.equal(isValidTckn('00000000146'), false, 'sıfırla başlayamaz');
  });
  it('biçim hatası kaydı engeller, kontrol hanesi yalnızca uyarır', () => {
    assert.equal(taxIdError(''), null);
    assert.match(taxIdError('12ab')!, /rakam/);
    assert.match(taxIdError('12345')!, /10.*11/);
    assert.equal(taxIdError('390 038 3669'), null);
    assert.equal(taxIdWarning('3900383669'), null);
    assert.match(taxIdWarning('3900383668')!, /VKN geçerli görünmüyor/);
    assert.match(taxIdWarning('10000000147')!, /TCKN/);
  });
});

describe('fiş no', () => {
  it('önek ve boşluklar atılır; baştaki sıfırlar karşılaştırmada önemsiz', () => {
    assert.equal(cleanFisNo('FİŞ NO: 0045'), '0045');
    assert.equal(cleanFisNo('No. 12 34'), '1234');
    assert.equal(cleanFisNo(45), '45');
    assert.equal(cleanFisNo(null), '');
    assert.ok(sameFisNo('0045', '45'));
    assert.equal(sameFisNo('', ''), false);
  });
});

describe('etiketler', () => {
  it('virgülle ayrılır, # atılır, tekrarlar harf farkı gözetmeden bir kez sayılır', () => {
    assert.deepEqual(parseTags('X projesi, #müşteri yemeği,  x PROJESİ ;; '), ['X projesi', 'müşteri yemeği']);
    assert.deepEqual(parseTags(['a', 'A', ' b ']), ['a', 'b']);
    assert.equal(parseTags(Array.from({ length: 30 }, (_, i) => `t${i}`)).length, 20);
  });
});

describe('mükerrer fiş', () => {
  const a = { toplam_tutar: 120, fis_no: '0045', vkn: '3900383669' };
  it('fiş no ve VKN aynıysa tutar farklı okunmuş olsa da aynı fiş', () => assert.ok(isLikelyDuplicate(a, { ...a, toplam_tutar: 12 })));
  it('aynı gün, aynı tutar ama farklı fiş no: ayrı fişler (iki kahve)', () => assert.equal(isLikelyDuplicate(a, { ...a, fis_no: '0046' }), false));
  it('farklı VKN: ayrı firmalar', () => assert.equal(isLikelyDuplicate(a, { ...a, vkn: '1234567890' }), false));
  it('VKN yoksa fiş no ve tutar birlikte eşleşmeli', () => {
    assert.ok(isLikelyDuplicate({ toplam_tutar: 50, fis_no: '7' }, { toplam_tutar: 50, fis_no: '007', vkn: null }));
    assert.equal(isLikelyDuplicate({ toplam_tutar: 50, fis_no: '7' }, { toplam_tutar: 60, fis_no: '7' }), false);
  });
  it('fiş no yoksa eski kural: aynı tutar', () => {
    assert.ok(isLikelyDuplicate({ toplam_tutar: 99.9 }, { toplam_tutar: 99.9, fis_no: '12' }));
    assert.equal(isLikelyDuplicate({ toplam_tutar: 99.9 }, { toplam_tutar: 99.8 }), false);
  });
});
