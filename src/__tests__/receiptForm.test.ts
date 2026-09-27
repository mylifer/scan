import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emptyForm, fromFormValues, toFormValues, validateForm } from '../lib/receiptForm';

const ok = { firmaAdi: 'A101', tarih: '14.09.2026', toplamTutar: 120, kdvYuzde1: 0, kdvYuzde10: 0, kdvYuzde20: 20, kategori: 'market' as const };

describe('form', () => {
  it('gidiş-dönüş dönüşümü veriyi korur', () => assert.deepEqual(fromFormValues(toFormValues(ok)), ok));
  it('geçerli formda hata yok', () => assert.deepEqual(validateForm(toFormValues(ok)), []));
  it('boş formda tarih bugündür ve kaydedilemez', () => {
    const f = emptyForm();
    assert.match(f.tarih, /^\d{2}\.\d{2}\.\d{4}$/);
    assert.ok(validateForm(f).length >= 2);
  });
  it('KDV toplamı tutarı aşarsa (TOPLAM/TOPKDV karışması) uyarır', () => {
    const errors = validateForm({ ...toFormValues(ok), toplamTutar: '20,00', kdvYuzde20: '120,00' });
    assert.ok(errors.some((e) => e.includes('TOPKDV')));
  });
  it('bozuk tarihi yakalar', () => assert.ok(validateForm({ ...toFormValues(ok), tarih: '32.13.2026' }).some((e) => e.includes('Tarih'))));
});
