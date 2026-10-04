import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findFirmGroups, firmTokens } from '../lib/firmMerge';

const m = (o: Record<string, number>) => new Map(Object.entries(o));

describe('firma birleştirme önerileri', () => {
  it('sadeleştirme: Türkçe harf, noktalama, şirket ekleri', () => {
    assert.deepEqual(firmTokens('MİGROS TİCARET A.Ş.'), ['migros']);
    assert.deepEqual(firmTokens('Migros'), ['migros']);
    assert.deepEqual(firmTokens('ŞOK MARKETLER TİC. A.Ş.'), ['sok', 'marketler']);
    assert.deepEqual(firmTokens('OPET PETROLCÜLÜK A.Ş.'), ['opet', 'petrolculuk']);
  });

  it('aynı firmanın yazımları gruplanır, en çok kullanılan önerilir', () => {
    const g = findFirmGroups(m({ 'MİGROS TİCARET A.Ş.': 5, Migros: 2, MIGROS: 1, 'OPET PETROLCÜLÜK A.Ş.': 3, OPET: 1, 'BİM': 4 }));
    assert.equal(g.length, 2);
    assert.equal(g[0]!.suggested, 'MİGROS TİCARET A.Ş.');
    assert.deepEqual(g[0]!.variants.map((v) => v.name), ['MİGROS TİCARET A.Ş.', 'Migros', 'MIGROS']);
    assert.equal(g[0]!.total, 8);
    assert.equal(g[1]!.suggested, 'OPET PETROLCÜLÜK A.Ş.');
  });

  it('ilk kelimesi aynı ama farklı firmalar birleşmez', () => {
    assert.deepEqual(findFirmGroups(m({ 'TÜRK TELEKOM': 3, 'TÜRK HAVA YOLLARI': 2 })), []);
    assert.deepEqual(findFirmGroups(m({ 'A101 YENİ MAĞAZACILIK': 2, 'A102 KIRTASIYE': 1 })), []);
  });

  it('tek yazımlı firma ve boş adlar öneri üretmez', () => {
    assert.deepEqual(findFirmGroups(m({ 'BİM': 4, '...': 1 })), []);
  });
});
