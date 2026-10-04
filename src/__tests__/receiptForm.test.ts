import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { emptyForm, formWarnings, fromFormValues, setFormField, toFormValues, validateForm } from '../lib/receiptForm';

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

describe('uyarılar', () => {
  const today = new Date(2026, 8, 27);
  const base = toFormValues(ok); // 14.09.2026, 120 ₺, KDV 20 (%16,67 — sınırda)
  it('normal fişte uyarı yok', () => assert.deepEqual(formWarnings(base, today), []));
  it('ileri tarih', () => assert.ok(formWarnings({ ...base, tarih: '28.09.2026' }, today).some((w) => w.includes('ileri'))));
  it('bir yıldan eski', () => assert.ok(formWarnings({ ...base, tarih: '01.09.2025' }, today).some((w) => w.includes('bir yıldan'))));
  it('KDV oranı imkânsız', () => assert.ok(formWarnings({ ...base, kdvYuzde20: '30,00' }, today).some((w) => w.includes('%16,7'))));
  it('KDV hiç yok', () => assert.ok(formWarnings({ ...base, kdvYuzde20: '0,00' }, today).some((w) => w.includes('Hiç KDV'))));
});

describe('kategoriye göre KDV dilimi kontrolü', () => {
  const today = new Date(2026, 8, 27);
  const base = toFormValues(ok);
  it('akaryakıtta %10 dilimi uyarılır, %20 uyarılmaz', () => {
    assert.ok(!formWarnings({ ...base, kategori: 'akaryakıt' }, today).some((w) => w.includes('pek görülmez')));
    const w = formWarnings({ ...base, kategori: 'akaryakıt', kdvYuzde10: '5,00' }, today).find((x) => x.includes('pek görülmez'));
    assert.match(w!, /^Akaryakıt fişlerinde %10 KDV/);
  });
  it('restoranda %10 ve %20 normal, %1 uyarılır', () => {
    assert.ok(!formWarnings({ ...base, kategori: 'restoran', kdvYuzde10: '5,00' }, today).some((w) => w.includes('pek görülmez')));
    assert.ok(formWarnings({ ...base, kategori: 'restoran', kdvYuzde1: '1,00' }, today).some((w) => w.includes('%1 KDV pek görülmez')));
  });
  it('market gibi karışık kategoriler kontrol edilmez', () => {
    assert.ok(!formWarnings({ ...base, kategori: 'market', kdvYuzde1: '1,00', kdvYuzde10: '2,00' }, today).some((w) => w.includes('pek görülmez')));
  });
  it('iki alışılmadık dilim birlikte söylenir', () => {
    assert.ok(formWarnings({ ...base, kategori: 'iletişim', kdvYuzde1: '1,00', kdvYuzde10: '2,00' }, today).some((w) => w.includes('%1 ve %10')));
  });
});

describe('emin olunamayan alanlar', () => {
  it('forma taşınır, düzenlenen alanın işareti kalkar, kayda girmez', () => {
    const v = toFormValues({ ...ok, eminOlunmayanlar: ['tarih', 'toplamTutar'] });
    assert.deepEqual(v.belirsiz, ['tarih', 'toplamTutar']);
    const v2 = setFormField(v, 'toplamTutar', '130,00');
    assert.deepEqual(v2.belirsiz, ['tarih']);
    assert.deepEqual(v.belirsiz, ['tarih', 'toplamTutar'], 'önceki değer değişmez');
    const v3 = setFormField(v2, 'tarih', '15.09.2026');
    assert.equal('belirsiz' in v3, false);
    assert.equal('eminOlunmayanlar' in fromFormValues(v), false);
    assert.equal('belirsiz' in toFormValues(ok), false);
  });
});
