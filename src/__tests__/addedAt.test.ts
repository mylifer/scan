import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addedAtLabel } from '../lib/addedAt';

describe('eklenme zamanı', () => {
  const now = new Date(2026, 9, 11, 15, 0);
  it('bugün / dün / tarih', () => {
    assert.equal(addedAtLabel(new Date(2026, 9, 11, 14, 32).toISOString(), now), 'Bugün 14:32');
    assert.equal(addedAtLabel(new Date(2026, 9, 10, 9, 5).toISOString(), now), 'Dün 09:05');
    assert.equal(addedAtLabel(new Date(2026, 9, 2, 8, 0).toISOString(), now), '2 Eki 08:00');
    assert.equal(addedAtLabel(new Date(2025, 11, 30, 8, 0).toISOString(), now), '30 Ara 2025 08:00');
    assert.equal(addedAtLabel('bozuk', now), '');
  });
});
