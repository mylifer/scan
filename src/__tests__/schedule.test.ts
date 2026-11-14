import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatRunAt, nextRunAt } from '../lib/schedule';

describe('planlama (Türkiye saati)', () => {
  it('saat henüz geçmediyse bugün', () => {
    // 27 Eylül 08:00 TR = 05:00 UTC
    const at = nextRunAt(10, new Date('2026-09-27T05:00:00Z'));
    assert.equal(at.toISOString(), '2026-09-27T07:00:00.000Z');
  });
  it('saat geçtiyse yarın', () => {
    const at = nextRunAt(10, new Date('2026-09-27T08:00:00Z'));
    assert.equal(at.toISOString(), '2026-09-28T07:00:00.000Z');
  });
  it('gece yarısı sınırında TR gününe göre çalışır', () => {
    // 27 Eylül 23:30 UTC = 28 Eylül 02:30 TR → 03:00 aynı TR gününde
    const at = nextRunAt(3, new Date('2026-09-27T23:30:00Z'));
    assert.equal(at.toISOString(), '2026-09-28T00:00:00.000Z');
  });
  it('Bugün / Yarın etiketleri', () => {
    const now = new Date('2026-09-27T05:00:00Z');
    assert.equal(formatRunAt('2026-09-27T07:00:00Z', now), 'Bugün 10:00');
    assert.equal(formatRunAt('2026-09-28T07:00:00Z', now), 'Yarın 10:00');
  });
});

describe('Kota yenilenme saati (Pasifik gece yarısı)', () => {
  it('ABD yaz saatinde 10:00, kışın 11:00 (Türkiye)', async () => {
    const { quotaResetHourTr, scheduleHours } = await import('../lib/schedule');
    assert.equal(quotaResetHourTr(new Date('2026-07-15T12:00:00Z')), 10);
    assert.equal(quotaResetHourTr(new Date('2026-11-13T12:00:00Z')), 11);
    assert.equal(quotaResetHourTr(new Date('2026-01-10T23:30:00Z')), 11);
    assert.deepEqual(scheduleHours(new Date('2026-11-13T12:00:00Z')), [3, 7, 11, 13]);
  });
});
