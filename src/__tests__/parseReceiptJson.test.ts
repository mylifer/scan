import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeFisNo, normalizeVergiNo, parseReceiptJson } from '../services/vision/parseReceiptJson';
import { VisionServiceError } from '../services/vision/VisionService';

describe('parseReceiptJson', () => {
  it('markdown çitli ve biçimsiz yanıtı düzeltir', () => {
    const d = parseReceiptJson(
      '```json\n{"firmaAdi":" OPET ","tarih":"12.9.2026","toplamTutar":"1.500,00","kdvYuzde1":0,"kdvYuzde10":null,"kdvYuzde20":"250","kategori":"Akaryakıt"}\n```',
    );
    assert.deepEqual(d, { firmaAdi: 'OPET', tarih: '12.09.2026', toplamTutar: 1500, kdvYuzde1: 0, kdvYuzde10: 0, kdvYuzde20: 250, kategori: 'akaryakıt', fisNo: '', vergiNo: '', odeme: null });
  });
  it('bilinmeyen kategoriyi en yakınına eşler', () => {
    assert.equal(parseReceiptJson('{"kategori":"Süpermarket"}').kategori, 'market');
    assert.equal(parseReceiptJson('{"kategori":"benzin istasyonu"}').kategori, 'akaryakıt');
    assert.equal(parseReceiptJson('{"kategori":"kırtasiye"}').kategori, 'ofis gideri');
    assert.equal(parseReceiptJson('{"kategori":"Ulaşım"}').kategori, 'ulaşım');
    assert.equal(parseReceiptJson('{"kategori":"otopark"}').kategori, 'ulaşım');
    assert.equal(parseReceiptJson('{"kategori":"lastik değişimi"}').kategori, 'araç bakım');
    assert.equal(parseReceiptJson('{"kategori":"otel"}').kategori, 'konaklama');
    assert.equal(parseReceiptJson('{"kategori":"elektrik faturası"}').kategori, 'faturalar');
    assert.equal(parseReceiptJson('{"kategori":"kurye"}').kategori, 'kargo');
    assert.equal(parseReceiptJson('{"kategori":"Giyim"}').kategori, 'giyim');
    assert.equal(parseReceiptJson('{"kategori":"ayakkabı"}').kategori, 'giyim');
    assert.equal(parseReceiptJson('{"kategori":"çiçekçi"}').kategori, 'diğer');
  });
  it('geçersiz tarihte bugünün tarihini kullanır', () => {
    assert.match(parseReceiptJson('{"tarih":"yok"}').tarih, /^\d{2}\.\d{2}\.\d{4}$/);
  });
  it('JSON yoksa anlaşılır hata verir', () => {
    assert.throws(() => parseReceiptJson('Üzgünüm, okuyamadım'), VisionServiceError);
    assert.throws(() => parseReceiptJson('[1,2]'), VisionServiceError);
  });
});

describe('fiş ayrıntıları', () => {
  it('fiş no, vergi no ve ödeme şeklini okur', () => {
    const d = parseReceiptJson('{"firmaAdi":"MİGROS","fisNo":"FİŞ NO: 0042","vergiNo":"622 052 9513","odeme":"KREDİ KARTI","kategori":"market"}');
    assert.equal(d.fisNo, '0042');
    assert.equal(d.vergiNo, '6220529513');
    assert.equal(d.odeme, 'kart');
  });
  it('geçersiz vergi noyu ve bilinmeyen ödemeyi boş bırakır', () => {
    const d = parseReceiptJson('{"vergiNo":"12345","odeme":"","fisNo":""}');
    assert.equal(d.vergiNo, '');
    assert.equal(d.odeme, null);
    assert.equal(d.fisNo, '');
  });
  it('TCKN (11 hane) kabul edilir', () => {
    assert.equal(normalizeVergiNo('12345678901'), '12345678901');
    assert.equal(normalizeFisNo(42), '42');
  });
});
