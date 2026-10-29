import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isSent, summarizeReceipts } from '../lib/summary';
import type { ReceiptRecord } from '../types/receipt';

const r = (id: string, toplam: number, kategori: string, k20: number, sent: string | null = null): ReceiptRecord => ({
  id,
  created_at: '2026-10-01T10:00:00Z',
  firma_adi: id,
  tarih: '2026-10-01',
  toplam_tutar: toplam,
  kdv_yuzde1: 0,
  kdv_yuzde10: 0,
  kdv_yuzde20: k20,
  toplam_kdv: k20,
  kategori,
  image_path: null,
  fis_no: null,
  vkn: null,
  notlar: null,
  etiketler: [],
  muhasebe_gonderildi_at: sent,
});

describe('dönem özeti', () => {
  it('toplamlar ve kategori payları (büyükten küçüğe)', () => {
    const s = summarizeReceipts([r('a', 120, 'market', 20), r('b', 60.1, 'restoran', 5.46), r('c', 30, 'market', 5)]);
    assert.equal(s.toplamGider, 210.1);
    assert.equal(s.toplamKdv, 30.46);
    assert.equal(s.fisSayisi, 3);
    assert.deepEqual(s.kategoriToplamlari, [
      { kategori: 'market', toplam: 150 },
      { kategori: 'restoran', toplam: 60.1 },
    ]);
  });
  it('gönderilenler hariç tutulunca yalnızca kalanların toplamı', () => {
    const list = [r('a', 120, 'market', 20, '2026-10-05T09:00:00Z'), r('b', 60, 'restoran', 5)];
    const s = summarizeReceipts(list.filter((x) => !isSent(x)));
    assert.equal(s.fisSayisi, 1);
    assert.equal(s.toplamGider, 60);
    assert.equal(s.toplamKdv, 5);
  });
});
