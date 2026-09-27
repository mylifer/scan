import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { budgetStatus } from '../lib/budgetMath';

describe('budgetStatus', () => {
  it('bütçe içinde', () => {
    assert.deepEqual(budgetStatus(2500, 10000), { ratio: 0.25, remaining: 7500, over: 0, level: 'ok' });
  });
  it('%80 sonrası uyarı', () => {
    assert.equal(budgetStatus(8000, 10000).level, 'warning');
    assert.equal(budgetStatus(10000, 10000).level, 'warning');
  });
  it('aşım', () => {
    const s = budgetStatus(11200, 10000);
    assert.equal(s.level, 'over');
    assert.equal(s.over, 1200);
    assert.equal(s.remaining, 0);
  });
});
