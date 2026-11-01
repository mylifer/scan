import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { kdvVerileriniGetir } from '../lib/kdvYukle';

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
