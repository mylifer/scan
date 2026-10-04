import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { monthOffset, planMonthlySummary } from '../lib/monthlySummaryPlan';

describe('aylık özet bildirimi', () => {
  it('ayın rakamlarıyla izleyen ayın 1i 10:00', () => {
    const n = planMonthlySummary({ total: 2657.3, kdv: 442.97, count: 3 }, new Date(2026, 9, 4, 15, 0));
    assert.equal(n.month, '2026-10');
    assert.equal(n.title, 'Ekim 2026 özeti');
    assert.equal(n.date.getTime(), new Date(2026, 10, 1, 10, 0).getTime());
    assert.match(n.body, /2\.657,30 gider · .*442,97 KDV · 3 fiş/);
  });
  it('aralıkta yıl devreder; fiş yoksa ayrı metin', () => {
    const n = planMonthlySummary({ total: 0, kdv: 0, count: 0 }, new Date(2026, 11, 31, 23, 59));
    assert.equal(n.date.getTime(), new Date(2027, 0, 1, 10, 0).getTime());
    assert.match(n.body, /Aralık 2026 için hiç fiş eklenmedi/);
  });
  it('ay farkı', () => {
    const now = new Date(2026, 10, 1, 10, 0);
    assert.equal(monthOffset('2026-10', now), -1);
    assert.equal(monthOffset('2025-11', now), -12);
    assert.equal(monthOffset('2026-11', now), 0);
    assert.equal(monthOffset('2026-12', now), null);
    assert.equal(monthOffset('bozuk', now), null);
  });
});
