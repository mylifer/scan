import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { trashCutoff, trashDaysLeft, trashLeftLabel } from '../lib/trash';

describe('çöp kutusu süresi', () => {
  const now = new Date('2026-10-04T12:00:00Z');
  it('kalan takvim günü (yerel saat)', () => {
    const local = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).toISOString();
    const at = new Date(2026, 9, 4, 12); // 4 Ekim 12:00
    assert.equal(trashDaysLeft(local(2026, 10, 4, 11), at), 30);
    assert.equal(trashDaysLeft(local(2026, 9, 5, 13), at), 1, '5 Ekim 13:00 → yarın');
    assert.equal(trashDaysLeft(local(2026, 9, 5, 9), at), 1, '5 Ekim 09:00 → yarın');
    assert.equal(trashDaysLeft(local(2026, 9, 4, 20), at), 0, 'bugün akşam');
    assert.equal(trashDaysLeft(local(2026, 9, 1, 0), at), 0, 'süresi geçmiş');
    assert.equal(trashDaysLeft('bozuk', at), 0);
  });
  it('kesim anı 30 gün önce', () => assert.equal(trashCutoff(now), '2026-09-04T12:00:00.000Z'));
  it('etiket', () => {
    assert.equal(trashLeftLabel(0), 'Bugün silinecek');
    assert.equal(trashLeftLabel(1), 'Yarın silinecek');
    assert.equal(trashLeftLabel(12), '12 gün kaldı');
  });
});
