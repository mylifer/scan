import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kdvVerileriniGetir, oncekiGelenleriGetir } from '../lib/kdvYukle';

const asla = () => new Promise<never>(() => {});

describe('KDV verilerini getir', () => {
  it('hepsi gelirse hata yok', async () => {
    const r = await kdvVerileriniGetir({
      gelen: async () => ({ faturalar: ['g'] }),
      giden: async () => ({ faturalar: ['s'] }),
      fisler: async () => [1, 2],
    });
    assert.deepEqual([r.gelen, r.giden, r.fisler, r.qnbHatasi], [['g'], ['s'], [1, 2], null]);
    assert.deepEqual([r.gelenOk, r.gidenOk], [true, true]);
  });

  it('QNB askıda kalırsa fişlerle devam eder ve nedeni bildirir', async () => {
    const r = await kdvVerileriniGetir({ gelen: asla, giden: async () => ({ faturalar: ['s'] }), fisler: async () => [1], qnbMs: 20 });
    assert.deepEqual(r.gelen, []);
    assert.deepEqual(r.giden, ['s']);
    assert.deepEqual(r.fisler, [1]);
    assert.deepEqual([r.gelenOk, r.gidenOk], [false, true]);
    assert.match(String(r.qnbHatasi), /QNB \(gelen e-Faturalar\)/);
  });

  it('QNB hata verirse de fişlerle devam eder', async () => {
    const r = await kdvVerileriniGetir({
      gelen: async () => {
        throw new Error('QNB girişi başarısız');
      },
      giden: async () => ({ faturalar: [] }),
      fisler: async () => [],
    });
    assert.match(String(r.qnbHatasi), /QNB girişi başarısız/);
  });

  it('fişler alınamazsa hata fırlatır', async () => {
    await assert.rejects(
      kdvVerileriniGetir({ gelen: async () => ({ faturalar: [] }), giden: async () => ({ faturalar: [] }), fisler: asla, fisMs: 20 }),
      /Fiş sorgusu/,
    );
  });
});

describe('Önceki ayların gelen e-Faturaları', () => {
  it('QNB gelmezse kayıtlıyı kullanır, o da yoksa ayı eksik sayar; en fazla 2 eşzamanlı istek', async () => {
    let aktif = 0;
    let enCok = 0;
    const r = await oncekiGelenleriGetir(['2026-09', '2026-08', '2026-07'], {
      getir: async (ay) => {
        aktif += 1;
        enCok = Math.max(enCok, aktif);
        await new Promise((res) => setTimeout(res, 5));
        aktif -= 1;
        if (ay === '2026-09') return { faturalar: ['eylul'] };
        throw new Error('QNB');
      },
      kayitli: (ay) => (ay === '2026-08' ? ['agustos-kayitli'] : null),
      eszamanli: 2,
    });
    assert.deepEqual(r.faturalar, ['eylul', 'agustos-kayitli']);
    assert.deepEqual(r.eksikAylar, ['2026-07']);
    assert.equal(enCok, 2);
  });

  it('süre aşımında kayıtlıya düşer', async () => {
    const r = await oncekiGelenleriGetir(['2026-09'], { getir: asla, kayitli: async () => ['k'], qnbMs: 10 });
    assert.deepEqual(r, { faturalar: ['k'], eksikAylar: [] });
  });
});
