import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMonthlySeries, compactTL, emptySeries, niceMax } from '../lib/trend';

const now = new Date(2026, 8, 27); // 27 Eylül 2026

describe('aylık seri', () => {
  it('12 ay, eskiden yeniye, bu ay offset 0', () => {
    const s = emptySeries(12, now);
    assert.equal(s.length, 12);
    assert.equal(s[0].key, '2025-10');
    assert.equal(s[11].key, '2026-09');
    assert.equal(s[11].offset, 0);
    assert.equal(s[0].offset, -11);
    assert.equal(s[11].label, 'Eylül 2026');
  });
  it('fişleri aylara toplar, seri dışını yok sayar', () => {
    const s = buildMonthlySeries(
      [
        { tarih: '2026-09-14', toplam_tutar: 100.1, toplam_kdv: 16.68 },
        { tarih: '2026-09-02', toplam_tutar: 0.2, toplam_kdv: 0.02 },
        { tarih: '2026-01-10', toplam_tutar: 50, toplam_kdv: 5 },
        { tarih: '2024-01-10', toplam_tutar: 999, toplam_kdv: 99 },
      ],
      12,
      now,
    );
    assert.equal(s[11].total, 100.3);
    assert.equal(s[11].kdv, 16.7);
    assert.equal(s.find((p) => p.key === '2026-01')!.total, 50);
    assert.equal(s.reduce((a, p) => a + p.total, 0), 150.3);
  });
});

describe('eksen', () => {
  it('niceMax', () => {
    assert.equal(niceMax(4300), 5000);
    assert.equal(niceMax(1800), 2000);
    assert.equal(niceMax(2100), 2500);
    assert.equal(niceMax(0), 1000);
    assert.equal(niceMax(10000), 10000);
    assert.equal(niceMax(6100), 8000);
    assert.equal(niceMax(1100), 1200);
  });
  it('compactTL', () => {
    assert.equal(compactTL(5000), '5 B');
    assert.equal(compactTL(12500), '12,5 B');
    assert.equal(compactTL(800), '800');
    assert.equal(compactTL(2_500_000), '2,5 Mn');
  });
});
