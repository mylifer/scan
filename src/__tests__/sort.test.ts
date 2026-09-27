import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sortReceipts } from '../lib/sort';

const r = (id: string, tarih: string, toplam_tutar: number, created_at = '2026-09-01T00:00:00Z') => ({ id, tarih, toplam_tutar, created_at });
const rows = [r('a', '2026-09-10', 50), r('b', '2026-09-14', 300), r('c', '2026-09-01', 120), r('d', '2026-09-14', 80, '2026-09-15T00:00:00Z')];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join('');

describe('sortReceipts', () => {
  it('tarihe göre', () => {
    assert.equal(ids(sortReceipts(rows, 'newest')), 'dbac');
    assert.equal(ids(sortReceipts(rows, 'oldest')), 'cabd');
  });
  it('tutara göre', () => {
    assert.equal(ids(sortReceipts(rows, 'highest')), 'bcda');
    assert.equal(ids(sortReceipts(rows, 'lowest')), 'adcb');
  });
  it('girdiyi değiştirmez', () => {
    sortReceipts(rows, 'oldest');
    assert.equal(ids(rows), 'abcd');
  });
});
