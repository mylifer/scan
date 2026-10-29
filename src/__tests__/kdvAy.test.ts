import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EFatura } from '../../supabase/functions/qnb-efatura/soap';
import { kdvAyHesapla } from '../lib/kdvAy';
import type { ReceiptRecord } from '../types/receipt';

const fatura = (ettn: string, tutar: number, kdv: number | undefined, extra: Partial<EFatura> = {}): EFatura => ({
  ettn,
  belgeNo: ettn,
  tarih: '2026-10-10',
  unvan: 'Firma',
  vkn: '1111111111',
  tutar,
  paraBirimi: 'TRY',
  profil: 'TEMELFATURA',
  ...(kdv === undefined ? {} : { kdv }),
  ...extra,
});

const fis = (id: string, tarih: string, toplam: number, kdv: number, vkn: string | null = null) =>
  ({ id, tarih, toplam_tutar: toplam, toplam_kdv: kdv, vkn }) as unknown as ReceiptRecord;

describe('Aylık KDV', () => {
  it('Ekim 2026 örneği: tevkifat düşülür, iade ayrı, olağan dışı hariç', () => {
    const giden = [
      fatura('s1', 145530, 29400, { tevkifat: 8820, tip: 'TEVKIFAT' }),
      fatura('i1', 9893.99, 899.45, { tip: 'IADE' }),
      fatura('x', 144000000, 24000000, { tip: 'SATIS' }),
      fatura('t', 100, 20, { taslak: true }),
    ];
    const gelen = [fatura('g1', 1200, 200), fatura('g2', 120, 20), fatura('g3', 50, undefined)];
    const k = kdvAyHesapla(gelen, giden, [], new Set(['x']));
    assert.deepEqual(k.kestigim, { faturada: 29400, tevkifat: 8820, beyan: 20580, adet: 1 });
    assert.deepEqual(k.iade, { kdv: 899.45, adet: 1 });
    assert.deepEqual(k.gelenEfatura, { kdv: 220, adet: 3, eksik: 1 });
    assert.equal(k.dusulebilir, 220);
    assert.equal(k.sonuc, 20360);
  });

  it('e-Faturayla aynı alışveriş olan fiş iki kez sayılmaz', () => {
    const gelen = [fatura('g1', 1753.14, 160, { tarih: '2026-10-02', vkn: '6220529513' })];
    const fisler = [
      fis('a', '2026-10-02', 1753.14, 160, '6220529513'), // aynı alışveriş
      fis('b', '2026-10-02', 1753.1, 160, null), // ±5 kuruş ama e-Fatura zaten eşleşti
      fis('c', '2026-10-05', 300, 50),
    ];
    const k = kdvAyHesapla(gelen, [], fisler);
    assert.deepEqual(k.fis, { kdv: 210, adet: 2, eslesen: 1 });
    assert.equal(k.dusulebilir, 370);
  });

  it('düşülebilir fazlaysa sonuç negatif (devreden)', () => {
    const k = kdvAyHesapla([fatura('g', 600, 100)], [fatura('s', 60, 10)], []);
    assert.equal(k.sonuc, -90);
  });

  it('farklı VKN eşleşmez', () => {
    const k = kdvAyHesapla([fatura('g', 100, 18, { vkn: '1' })], [], [fis('a', '2026-10-10', 100, 18, '2')]);
    assert.equal(k.fis.eslesen, 0);
    assert.equal(k.dusulebilir, 36);
  });
});
