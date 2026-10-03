import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { monthlyInsights } from '../lib/insights';

const r = (firma_adi: string, tarih: string, toplam_tutar: number, kategori: 'market' | 'akaryakıt' | 'restoran', toplam_kdv = 0) => ({
  firma_adi,
  tarih,
  toplam_tutar,
  toplam_kdv,
  kategori,
});

const fisler = [
  r('MİGROS', '2026-09-03', 400, 'market', 4),
  r('Migros ', '2026-09-10', 600, 'market', 6),
  r('OPET', '2026-09-12', 1500, 'akaryakıt', 250),
  r('KÖFTECİ', '2026-09-20', 300, 'restoran', 27.27),
];
const base = { fisler, toplamGider: 2800, toplamKdv: 287.27 };

describe('aylık içgörüler', () => {
  it('geçmiş ay: artan ve azalan kategori, firma, en büyük fiş, KDV', () => {
    const list = monthlyInsights({ ...base, previous: [{ kategori: 'akaryakıt', toplam: 500 }, { kategori: 'restoran', toplam: 1200 }, { kategori: 'market', toplam: 900 }], current: null });
    const by = Object.fromEntries(list.map((i) => [i.kind, i.text]));
    assert.match(by['category-up']!, /Akaryakıt.*1\.000,00.*%200/);
    assert.match(by['category-down']!, /Restoran.*900,00.*%75/);
    // Büyük/küçük harf ve boşluk farkı aynı firma sayılır; OPET tutarca önde ama tek fiş → Migros
    assert.match(by['top-firm']!, /MİGROS — 2 fiş, .*1\.000,00/);
    assert.match(by.largest!, /OPET.*1\.500,00.*12 Eylül/);
    assert.match(by.kdv!, /287,27.*%10/);
    assert.equal(by.pace, undefined, 'geçmiş ay için tahmin yok');
  });

  it('küçük değişimler gürültü sayılır; önceki ay yoksa kategori cümlesi yok', () => {
    const small = monthlyInsights({ ...base, previous: [{ kategori: 'akaryakıt', toplam: 1400 }, { kategori: 'market', toplam: 950 }, { kategori: 'restoran', toplam: 280 }], current: null });
    assert.ok(!small.some((i) => i.kind.startsWith('category')));
    assert.ok(!monthlyInsights({ ...base, previous: null, current: null }).some((i) => i.kind.startsWith('category')));
  });

  it('bu ay: azalış söylenmez, ilk haftadan sonra gidişat tahmini', () => {
    const list = monthlyInsights({ ...base, previous: [{ kategori: 'restoran', toplam: 5000 }], current: { day: 10, daysInMonth: 30 } });
    assert.ok(!list.some((i) => i.kind === 'category-down'));
    assert.match(list.find((i) => i.kind === 'pace')!.text, /8\.400,00/);
    assert.ok(!monthlyInsights({ ...base, previous: null, current: { day: 5, daysInMonth: 30 } }).some((i) => i.kind === 'pace'));
  });

  it('yeni kategori ve boş ay', () => {
    const list = monthlyInsights({ ...base, previous: [{ kategori: 'market', toplam: 1000 }], current: null });
    assert.match(list.find((i) => i.kind === 'category-up')!.text, /Akaryakıt harcaması geçen ay yoktu, bu ay .*1\.500,00/);
    assert.deepEqual(monthlyInsights({ fisler: [], toplamGider: 0, toplamKdv: 0, previous: null, current: null }), []);
  });
});
