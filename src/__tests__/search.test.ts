import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { firmKey, learnedCategoryFor, matchesReceipt, normalizeForSearch } from '../lib/search';

const migros = { firma_adi: 'MİGROS TİCARET A.Ş.', toplam_tutar: 337.3 };
const opet = { firma_adi: 'OPET PETROLCÜLÜK', toplam_tutar: 1500 };

describe('arama', () => {
  it('Türkçe harflerden bağımsız', () => {
    assert.equal(normalizeForSearch('  MİGROS   Şube '), 'migros sube');
    assert.ok(matchesReceipt(migros, 'migros'));
    assert.ok(matchesReceipt(migros, 'ticaret'));
    assert.ok(matchesReceipt(opet, 'petrolculuk'));
  });
  it('boş sorgu hepsiyle eşleşir', () => assert.ok(matchesReceipt(opet, '  ')));
  it('tutarla arar', () => {
    assert.ok(matchesReceipt(migros, '337'));
    assert.ok(matchesReceipt(migros, '337,3'));
    assert.ok(matchesReceipt(migros, '337.30'));
    assert.ok(matchesReceipt(opet, '1.500'));
    assert.ok(matchesReceipt(opet, '1500'));
    assert.ok(!matchesReceipt(opet, '337'));
  });
  it('eşleşmeyeni eler', () => assert.ok(!matchesReceipt(migros, 'shell')));
});

describe('firma kategorisi hafızası', () => {
  it('firmKey şirket eklerini atar', () => {
    assert.equal(firmKey('MİGROS TİCARET A.Ş.'), 'migros');
    assert.equal(firmKey('Migros Tic. AŞ'), 'migros');
    assert.equal(firmKey('OPET PETROLCÜLÜK A.Ş.'), 'opet petrolculuk');
    assert.equal(firmKey('A.Ş.'), '');
  });

  it('en yeni fişin kategorisini döner', () => {
    const rows = [
      { firma_adi: 'OPET PETROLCÜLÜK A.Ş.', kategori: 'araç bakım' },
      { firma_adi: 'Opet Petrolculuk AS', kategori: 'akaryakıt' },
      { firma_adi: 'MİGROS', kategori: 'market' },
    ];
    assert.equal(learnedCategoryFor(rows, 'opet petrolcülük a.ş'), 'araç bakım');
    assert.equal(learnedCategoryFor(rows, 'Migros Ticaret A.Ş.'), 'market');
    assert.equal(learnedCategoryFor(rows, 'A101'), null);
    assert.equal(learnedCategoryFor(rows, ''), null);
  });
});

describe('ek alanlarda arama', () => {
  const r = { firma_adi: 'MİGROS', toplam_tutar: 120, fis_no: '0045', vkn: '3900383669', notlar: 'Ahmet Bey ile toplantı', etiketler: ['X Projesi'] };
  it('not, etiket (# ile de), fiş no ve VKN bulunur', () => {
    assert.ok(matchesReceipt(r, 'toplanti'));
    assert.ok(matchesReceipt(r, 'proje'));
    assert.ok(matchesReceipt(r, '#x projesi'));
    assert.ok(matchesReceipt(r, '0045'));
    assert.ok(matchesReceipt(r, '3900383'));
    assert.equal(matchesReceipt(r, 'yok böyle'), false);
  });
  it('ek alanı olmayan eski kayıtlar sorun çıkarmaz', () => assert.equal(matchesReceipt({ firma_adi: 'A', toplam_tutar: 1 }, 'proje'), false));
});
