import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type ButceUzak, butceBirlestir, butceEsitle, gecerliButce, type UzakButce, uzakButceOku, uzakButceYaz } from '../lib/budgetSync';

function sahte(baslangic: UzakButce, hata = false) {
  let durum = baslangic;
  const yazilan: (number | null)[] = [];
  const uzak: ButceUzak = {
    oku: async () => {
      if (hata) throw new Error('ağ');
      return durum;
    },
    yaz: async (_u, d) => {
      if (hata) throw new Error('ağ');
      if (durum.durum === 'kurulu-degil') return false;
      yazilan.push(d);
      durum = { durum: 'var', deger: d };
      return true;
    },
  };
  return { uzak, yazilan };
}

describe('Bütçe bulut eşitlemesi', () => {
  it('birleştirme: bulutta kayıt varsa o, yoksa cihazdaki buluta taşınır, kurulum yoksa cihaz', () => {
    assert.deepEqual(butceBirlestir(5000, { durum: 'var', deger: 8000 }), { deger: 8000, buluta: false });
    assert.deepEqual(butceBirlestir(5000, { durum: 'var', deger: null }), { deger: null, buluta: false });
    assert.deepEqual(butceBirlestir(5000, { durum: 'yok' }), { deger: 5000, buluta: true });
    assert.deepEqual(butceBirlestir(null, { durum: 'yok' }), { deger: null, buluta: false });
    assert.deepEqual(butceBirlestir(5000, { durum: 'kurulu-degil' }), { deger: 5000, buluta: false });
  });

  it('ilk eşitlemede cihazdaki bütçe buluta yazılır', async () => {
    const { uzak, yazilan } = sahte({ durum: 'yok' });
    assert.deepEqual(await butceEsitle(uzak, 'u', 30000, false), { deger: 30000, bekleyen: false });
    assert.deepEqual(yazilan, [30000]);
  });

  it('başka cihazda değiştirilen bütçe alınır', async () => {
    const { uzak, yazilan } = sahte({ durum: 'var', deger: 42000 });
    assert.deepEqual(await butceEsitle(uzak, 'u', 30000, false), { deger: 42000, bekleyen: false });
    assert.deepEqual(yazilan, []);
  });

  it('internetsiz kaydedilen (bekleyen) değer buluttakini ezer', async () => {
    const { uzak, yazilan } = sahte({ durum: 'var', deger: 42000 });
    assert.deepEqual(await butceEsitle(uzak, 'u', null, true), { deger: null, bekleyen: false });
    assert.deepEqual(yazilan, [null]);
  });

  it('buluta ulaşılamazsa null döner (cihaz değeri ve bekleyen işaret kalır)', async () => {
    const { uzak } = sahte({ durum: 'var', deger: 1 }, true);
    assert.equal(await butceEsitle(uzak, 'u', 5, true), null);
  });

  it('geçersiz değerler null olur, kuruşa yuvarlanır', () => {
    assert.equal(gecerliButce('12500.50'), 12500.5);
    assert.equal(gecerliButce(0), null);
    assert.equal(gecerliButce(-5), null);
    assert.equal(gecerliButce('abc'), null);
    assert.equal(gecerliButce(1.234), 1.23);
  });

  it('Supabase: tablo yoksa kurulu değil, satır yoksa yok; yazma tablo yoksa false', async () => {
    const istemci = (sonuc: { data: unknown; error: { code?: string; message: string } | null }) => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => sonuc }) }),
        upsert: async () => sonuc,
      }),
    });
    const yok = { data: null, error: { code: 'PGRST205', message: 'yok' } };
    assert.deepEqual(await uzakButceOku(istemci(yok), 'u'), { durum: 'kurulu-degil' });
    assert.equal(await uzakButceYaz(istemci(yok), 'u', 5), false);
    assert.deepEqual(await uzakButceOku(istemci({ data: null, error: null }), 'u'), { durum: 'yok' });
    assert.deepEqual(await uzakButceOku(istemci({ data: { aylik_butce: '9000' }, error: null }), 'u'), { durum: 'var', deger: 9000 });
    await assert.rejects(uzakButceOku(istemci({ data: null, error: { code: '500', message: 'sunucu' } }), 'u'));
  });
});
