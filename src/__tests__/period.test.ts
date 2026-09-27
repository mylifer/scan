import assert from 'node:assert/strict';
import { test } from 'node:test';

import { periodLabel, periodRange, stepPeriod, switchMode, yearRange } from '../lib/period';

const NOW = new Date(2026, 8, 27); // 27 Eylül 2026

test('yearRange: yıl sınırları', () => {
  assert.deepEqual(yearRange(0, NOW), { from: '2026-01-01', to: '2027-01-01', label: '2026 yılı', fileTag: '2026' });
  assert.equal(yearRange(-1, NOW).from, '2025-01-01');
});

test('periodRange: ay, yıl, tüm zamanlar', () => {
  assert.equal(periodRange({ mode: 'month', offset: 0 }, NOW)?.fileTag, '2026-09');
  assert.equal(periodRange({ mode: 'year', offset: -2 }, NOW)?.fileTag, '2024');
  assert.equal(periodRange({ mode: 'all' }, NOW), undefined);
  assert.equal(periodLabel({ mode: 'all' }, NOW), 'Tüm zamanlar');
});

test('switchMode: yıldan aya geçişte o yılın Aralık ayı', () => {
  const m = switchMode({ mode: 'year', offset: -1 }, 'month', NOW);
  assert.equal(periodRange(m, NOW)?.fileTag, '2025-12');
  assert.deepEqual(switchMode({ mode: 'year', offset: 0 }, 'month', NOW), { mode: 'month', offset: 0 });
});

test('switchMode: aydan yıla geçişte ayın yılı', () => {
  assert.deepEqual(switchMode({ mode: 'month', offset: -9 }, 'year', NOW), { mode: 'year', offset: -1 });
  assert.deepEqual(switchMode({ mode: 'month', offset: -8 }, 'year', NOW), { mode: 'year', offset: 0 });
  assert.deepEqual(switchMode({ mode: 'all' }, 'year', NOW), { mode: 'year', offset: 0 });
});

test('stepPeriod: geleceğe gitmez', () => {
  assert.deepEqual(stepPeriod({ mode: 'year', offset: 0 }, 1), { mode: 'year', offset: 0 });
  assert.deepEqual(stepPeriod({ mode: 'month', offset: -3 }, -1), { mode: 'month', offset: -4 });
});
