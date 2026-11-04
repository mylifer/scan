import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchesSentFilter, sentFilterLabel, sentMonthGroups, sentMonthLabel } from '../lib/sentFilter';

const r = (at: string | null) => ({ muhasebe_gonderildi_at: at });

describe('sentFilter', () => {
  const rows = [r(null), r('2026-11-03T09:00:00Z'), r('2026-10-15T09:00:00Z'), r('2026-10-31T22:30:00Z'), r('2026-11-20T09:00:00Z')];

  it('gönderim aylarını yeniden eskiye gruplar (Türkiye saatiyle)', () => {
    // 31 Ekim 22:30 UTC = 1 Kasım 01:30 İstanbul
    assert.deepEqual(sentMonthGroups(rows), [
      { key: '2026-11', label: 'Kasım 2026', count: 3 },
      { key: '2026-10', label: 'Ekim 2026', count: 1 },
    ]);
  });

  it('filtreler', () => {
    assert.equal(rows.filter((x) => matchesSentFilter(x, 'all')).length, 5);
    assert.equal(rows.filter((x) => matchesSentFilter(x, 'unsent')).length, 1);
    assert.equal(rows.filter((x) => matchesSentFilter(x, 'sent')).length, 4);
    assert.equal(rows.filter((x) => matchesSentFilter(x, '2026-10')).length, 1);
    assert.equal(rows.filter((x) => matchesSentFilter(x, '2026-11')).length, 3);
  });

  it('etiketler', () => {
    assert.equal(sentMonthLabel('2026-01'), 'Ocak 2026');
    assert.equal(sentFilterLabel('2026-11'), 'Kasım 2026 gönderilenler');
    assert.equal(sentFilterLabel('unsent'), 'Bekleyenler');
  });
});
