import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { receiptShareText } from '../lib/receiptText';

describe('receiptShareText', () => {
  it('fişi okunur metne çevirir', () => {
    const text = receiptShareText({ firma_adi: 'MİGROS', tarih: '2026-09-14', kategori: 'market', toplam_tutar: 337.3, kdv_yuzde1: 0.57, kdv_yuzde10: 0, kdv_yuzde20: 46.63 });
    const lines = text.split('\n');
    assert.equal(lines[0], 'MİGROS');
    assert.equal(lines[1], '14.09.2026 · Market');
    assert.match(lines[2], /^Toplam: .*337,30$/);
    assert.match(lines[3], /^KDV: .*47,20 \(%1 .*0,57 · %20 .*46,63\)$/);
  });
  it('KDV yoksa dilim göstermez', () => {
    const text = receiptShareText({ firma_adi: 'X', tarih: '2026-01-02', kategori: 'diğer', toplam_tutar: 10, kdv_yuzde1: 0, kdv_yuzde10: 0, kdv_yuzde20: 0 });
    assert.match(text.split('\n')[3], /^KDV: [^(]*$/);
  });
});
