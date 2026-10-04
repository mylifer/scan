import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { trashCutoff, trashDaysLeft, trashLeftLabel } from '../lib/trash';

describe('çöp kutusu süresi', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  it('kalan gün', () => {
    assert.equal(trashDaysLeft('2026-10-04T11:00:00Z', now), 30);
    assert.equal(trashDaysLeft('2026-09-05T13:00:00Z', now), 1);
    assert.equal(trashDaysLeft('2026-09-01T00:00:00Z', now), 0);
    assert.equal(trashDaysLeft('bozuk', now), 0);
  });
  it('kesim anı 30 gün önce', () => assert.equal(trashCutoff(now), '2026-09-04T12:00:00.000Z'));
  it('etiket', () => {
    assert.equal(trashLeftLabel(0), 'Bugün kalıcı olarak silinecek');
    assert.equal(trashLeftLabel(1), 'Yarın kalıcı olarak silinecek');
    assert.equal(trashLeftLabel(12), '12 gün sonra kalıcı olarak silinecek');
  });
});
