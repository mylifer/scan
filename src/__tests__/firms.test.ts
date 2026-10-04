import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateFirms, firmKey, summarizeFirm } from '../lib/firms';

const r = (firma_adi: string, tarih: string, toplam_tutar: number, kdv20 = 0, kdv10 = 0) => ({
  firma_adi,
  tarih,
  toplam_tutar,
  kdv_yuzde1: 0,
  kdv_yuzde10: kdv10,
  kdv_yuzde20: kdv20,
  toplam_kdv: kdv10 + kdv20,
});

describe('firma listesi', () => {
  const rows = [
    r('MİGROS', '2026-09-03', 100.1, 16.68),
    r('Migros ', '2026-10-01', 200.2, 33.37),
    r('MİGROS', '2026-08-15', 50, 8.33),
    r('OPET  A.Ş.', '2026-09-10', 1500, 250),
    r('BİM', '2026-09-11', 45, 0, 4.09),
  ];
  it('büyük/küçük harf ve boşluk farkı aynı firma; tutara göre sıralı; en sık yazım', () => {
    const list = aggregateFirms(rows);
    assert.deepEqual(
      list.map((f) => [f.name, f.count, f.total, f.kdv, f.last]),
      [
        ['OPET  A.Ş.', 1, 1500, 250, '2026-09-10'],
        ['MİGROS', 3, 350.3, 58.38, '2026-10-01'],
        ['BİM', 1, 45, 4.09, '2026-09-11'],
      ],
    );
    assert.equal(firmKey(' migros  ticaret '), 'MİGROS TİCARET');
  });
  it('firma özeti', () => {
    const s = summarizeFirm(rows.filter((x) => firmKey(x.firma_adi) === 'MİGROS'));
    assert.deepEqual(s, { count: 3, total: 350.3, kdv: 58.38, kdv1: 0, kdv10: 0, kdv20: 58.38, average: 116.77, first: '2026-08-15', last: '2026-10-01' });
    assert.deepEqual(summarizeFirm([]), { count: 0, total: 0, kdv: 0, kdv1: 0, kdv10: 0, kdv20: 0, average: 0, first: null, last: null });
  });
});
