import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseReceiptJson } from '../services/vision/parseReceiptJson';
import { VisionServiceError } from '../services/vision/VisionService';

describe('parseReceiptJson', () => {
  it('markdown çitli ve biçimsiz yanıtı düzeltir', () => {
    const d = parseReceiptJson(
      '```json\n{"firmaAdi":" OPET ","tarih":"12.9.2026","toplamTutar":"1.500,00","kdvYuzde1":0,"kdvYuzde10":null,"kdvYuzde20":"250","kategori":"Akaryakıt"}\n```',
    );
    assert.deepEqual(d, { firmaAdi: 'OPET', tarih: '12.09.2026', toplamTutar: 1500, kdvYuzde1: 0, kdvYuzde10: 0, kdvYuzde20: 250, kategori: 'akaryakıt' });
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
    assert.equal(parseReceiptJson('{"kategori":"çiçekçi"}').kategori, 'hediye');
    assert.equal(parseReceiptJson('{"kategori":"eczane"}').kategori, 'sağlık');
    assert.equal(parseReceiptJson('{"kategori":"Yapı Marketi"}').kategori, 'yapı market');
    assert.equal(parseReceiptJson('{"kategori":"kuaför"}').kategori, 'kişisel bakım');
    assert.equal(parseReceiptJson('{"kategori":"bilinmeyen şey"}').kategori, 'diğer');
  });
  it('kullanıcının kendi kategorisini harf farkı gözetmeden tanır', () => {
    const list = ['market', 'Proje X', 'diğer'];
    assert.equal(parseReceiptJson('{"kategori":"proje x"}', list).kategori, 'Proje X');
    assert.equal(parseReceiptJson('{"kategori":"Proje Y"}', list).kategori, 'diğer');
  });
  it('fiş no ve VKN/TCKN okunur; geçersiz uzunluktaki VKN atılır, boşlar hiç eklenmez', () => {
    const d = parseReceiptJson('{"firmaAdi":"X","fisNo":"FİŞ NO: 0045","vkn":"390 038 3669"}');
    assert.equal(d.fisNo, '0045');
    assert.equal(d.vkn, '3900383669');
    assert.equal(parseReceiptJson('{"vkn":"12345678901"}').vkn, '12345678901');
    const empty = parseReceiptJson('{"firmaAdi":"X","fisNo":"","vkn":"12345"}');
    assert.equal('fisNo' in empty, false);
    assert.equal('vkn' in empty, false);
  });
  it('geçersiz tarihte bugünün tarihini kullanır', () => {
    assert.match(parseReceiptJson('{"tarih":"yok"}').tarih, /^\d{2}\.\d{2}\.\d{4}$/);
  });
  it('JSON yoksa anlaşılır hata verir', () => {
    assert.throws(() => parseReceiptJson('Üzgünüm, okuyamadım'), VisionServiceError);
    assert.throws(() => parseReceiptJson('[1,2]'), VisionServiceError);
  });
  it('emin olunamayan alanları süzer; yoksa alan hiç eklenmez', () => {
    const d = parseReceiptJson('{"firmaAdi":"X","toplamTutar":10,"eminOlunmayanlar":["toplamTutar","uydurma","tarih","toplamTutar"]}');
    assert.deepEqual(d.eminOlunmayanlar, ['tarih', 'toplamTutar']);
    assert.equal('eminOlunmayanlar' in parseReceiptJson('{"firmaAdi":"X","eminOlunmayanlar":[]}'), false);
    assert.equal('eminOlunmayanlar' in parseReceiptJson('{"firmaAdi":"X","eminOlunmayanlar":"tarih"}'), false);
  });
});
