import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EFatura, TutarSatiri } from '../../supabase/functions/qnb-efatura/soap';
import { ayAraligi, aylarArasi, kdvFarki, olaganDisi, ozetle } from '../lib/efaturaOzet';

const satir = (ettn: string, tarih: string, matrah: number, kdv: number, extra: Partial<TutarSatiri> = {}): TutarSatiri => ({
  ettn,
  belgeNo: ettn,
  tarih,
  vkn: '',
  matrah,
  kdv,
  tevkifat: 0,
  odenecek: matrah + kdv,
  paraBirimi: 'TRY',
  oranlar: { '20': kdv },
  ...extra,
});

describe('e-Fatura özeti', () => {
  it('gelen/giden/iade ayrı toplanır; aynı ETTN bir kez; yıl ve ay dökümü', () => {
    const gelen = [satir('g1', '2026-09-03', 100, 20), satir('g2', '2026-10-01', 50, 10), satir('G1', '2026-09-03', 100, 20)];
    const giden = [
      satir('s1', '2026-10-05', 1000, 200),
      satir('i1', '2026-10-06', 200, 40, { tip: 'IADE' }),
      satir('t1', '2025-12-01', 500, 100, { tip: 'TEVKIFAT', tevkifat: 30 }),
      satir('usd', '2026-10-07', 999, 99, { paraBirimi: 'USD' }),
    ];
    const earsiv: EFatura[] = [
      { ettn: 'e1', belgeNo: 'E1', tarih: '2026-10-09', unvan: 'X', vkn: '', tutar: 120, paraBirimi: 'TRY', profil: 'EARSIVFATURA', tur: 'earsiv', kdv: 20, matrah: 100 },
      { ettn: 'e2', belgeNo: 'E2', tarih: '2026-10-09', unvan: 'Y', vkn: '', tutar: 60, paraBirimi: 'TRY', profil: 'EARSIVFATURA', tur: 'earsiv', kdv: 10, iptal: true },
    ];
    const { genel, yillar, aylar } = ozetle(gelen, giden, earsiv);
    assert.equal(genel.gelen.adet, 2, 'büyük/küçük harf farklı aynı ETTN bir kez');
    assert.equal(genel.gelen.kdv, 30);
    assert.equal(genel.satis.adet, 2, 'satış + tevkifat; USD hariç');
    assert.equal(genel.satis.kdv, 300);
    assert.equal(genel.satis.tevkifat, 30);
    assert.equal(genel.iade.kdv, 40);
    assert.equal(genel.earsiv.adet, 1, 'iptal e-Arşiv hariç');
    assert.equal(kdvFarki(genel), 300 + 20 - 30);
    assert.deepEqual(
      yillar.map((y) => y.donem),
      ['2026', '2025'],
    );
    assert.deepEqual(
      aylar.map((a) => a.donem),
      ['2026-10', '2026-09', '2025-12'],
    );
    assert.equal(aylar[0]!.satis.kdv, 200);
    assert.equal(genel.gelen.oranlar['20'], 30);
  });

  it('olağan dışı yüksek matrah', () => {
    const g = [satir('a', '2026-01-01', 120000, 24000), satir('b', '2026-02-01', 120000, 24000), satir('c', '2026-03-01', 120000, 24000), satir('d', '2025-11-29', 120000000, 24000000)];
    const t = olaganDisi(g);
    assert.equal(t.length, 1);
    assert.equal(t[0]!.tarih, '2025-11-29');
    assert.equal(t[0]!.kat, 1000);
    assert.deepEqual(olaganDisi(g.slice(0, 2)), [], 'az veride uyarı yok');
  });

  it('ay aralıkları', () => {
    assert.deepEqual(ayAraligi('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
    assert.deepEqual(aylarArasi('2025-11', new Date(2026, 1, 15)), ['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});
