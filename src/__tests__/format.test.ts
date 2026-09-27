import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { amountToInput, isoToTrDate, monthRange, normalizeTrDate, parseAmount, receiptImageName, round2, slugify, trDateToIso } from '../lib/format';

describe('parseAmount', () => {
  it('Türk biçimini okur', () => assert.equal(parseAmount('1.234,56'), 1234.56));
  it('İngiliz biçimini okur', () => assert.equal(parseAmount('1,234.56'), 1234.56));
  it('düz ondalığı okur', () => assert.equal(parseAmount('1234.56'), 1234.56));
  it('para simgesini atar', () => assert.equal(parseAmount('₺ 45,00'), 45));
  it('yalnızca binlik noktalarını çözer', () => assert.equal(parseAmount('1.234.567'), 1234567));
  it('sayıyı yuvarlar', () => assert.equal(parseAmount(12.345), 12.35));
  it('geçersizde 0 döner', () => {
    assert.equal(parseAmount('abc'), 0);
    assert.equal(parseAmount(null), 0);
    assert.equal(parseAmount(Number.NaN), 0);
  });
});

describe('tarih', () => {
  it('kısa tarihi tamamlar', () => assert.equal(normalizeTrDate('5.3.24'), '05.03.2024'));
  it('farklı ayırıcıları kabul eder', () => assert.equal(normalizeTrDate('05/03/2024'), '05.03.2024'));
  it('olmayan günü reddeder', () => assert.equal(normalizeTrDate('31.02.2024'), null));
  it('ISO dönüşümleri tutarlı', () => {
    assert.equal(trDateToIso('14.09.2026'), '2026-09-14');
    assert.equal(isoToTrDate('2026-09-14'), '14.09.2026');
  });
  it('ay aralığı yıl geçişini doğru hesaplar', () => {
    const r = monthRange(0, new Date(2026, 11, 15));
    assert.equal(r.from, '2026-12-01');
    assert.equal(r.to, '2027-01-01');
    const prev = monthRange(-12, new Date(2026, 0, 10));
    assert.equal(prev.from, '2025-01-01');
  });
});

describe('tutar yardımcıları', () => {
  it('round2', () => assert.equal(round2(0.1 + 0.2), 0.3));
  it('amountToInput virgül kullanır', () => assert.equal(amountToInput(1234.5), '1234,50'));
});

describe('dosya adları', () => {
  it('Türkçe karakterleri sadeleştirir', () => assert.equal(slugify('MİGROS TİCARET A.Ş.'), 'migros-ticaret-as'));
  it('uzun adları kelime ortasından kesmez', () => {
    const s = slugify('Çağdaş Kırtasiye & Ofis Ürünleri Ltd. Şti. Kadıköy Şubesi');
    assert.ok(s.length <= 40);
    assert.ok(!s.endsWith('-'));
    assert.equal(s, 'cagdas-kirtasiye-ofis-urunleri-ltd-sti');
  });
  it('boş firma adında "fis" kullanır', () => assert.match(receiptImageName('2026-09-14', '***'), /^2026-09-14_fis_[a-z0-9]{1,4}$/));
});
