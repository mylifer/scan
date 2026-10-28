import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { allCategories, categoryLabel, categoryNameError, cleanCategoryName, findCategory, setCustomCategories } from '../lib/categories';
import { KATEGORILER } from '../types/receipt';

describe('kategoriler', () => {
  afterEach(() => setCustomCategories([]));

  it('hazır kategoriler 25 tane, "diğer" hep sonda', () => {
    assert.equal(KATEGORILER.length, 25);
    assert.equal(allCategories().at(-1), 'diğer');
  });

  it('kendi kategorileri "diğer"den önce eklenir; tekrar ve hazır adlar atılır', () => {
    setCustomCategories(['Proje X', 'proje x', 'Market', '  Kırtasiye  ']);
    const all = allCategories();
    assert.deepEqual(all.slice(-3), ['Proje X', 'Kırtasiye', 'diğer']);
    assert.equal(all.filter((k) => k === 'Market').length, 0);
  });

  it('ad kontrolü: boş, çok uzun ve var olan ad reddedilir (Türkçe harf farkı gözetilmez)', () => {
    setCustomCategories(['Kırtasiye']);
    assert.match(categoryNameError('   ')!, /boş/);
    assert.match(categoryNameError('x'.repeat(41))!, /40/);
    assert.match(categoryNameError('KIRTASIYE')!, /zaten var/);
    assert.match(categoryNameError('Sağlık')!, /zaten var/);
    assert.equal(categoryNameError('Kırtasiye', undefined, 'Kırtasiye'), null, 'yeniden adlandırırken kendisi');
    assert.equal(categoryNameError('Proje Y'), null);
  });

  it('etiket: hazırda sabit ad, kendi kategorisinde ilk harf büyük', () => {
    assert.equal(categoryLabel('ofis gideri'), 'Ofis Gideri');
    assert.equal(categoryLabel('iş yemeği'), 'İş yemeği');
    assert.equal(cleanCategoryName('  a   b '), 'a b');
    assert.equal(findCategory('YAPI MARKET'), 'yapı market');
  });
});
