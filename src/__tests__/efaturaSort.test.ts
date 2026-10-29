import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EFatura } from '../../supabase/functions/qnb-efatura/soap';
import { isEFaturaSort, sortEFaturalar } from '../lib/efaturaSort';

const f = (belgeNo: string, tarih: string, unvan: string, tutar: number, kdv?: number): EFatura => ({
  ettn: belgeNo,
  belgeNo,
  tarih,
  unvan,
  vkn: '',
  tutar,
  paraBirimi: 'TRY',
  profil: '',
  ...(kdv === undefined ? {} : { kdv }),
});

const list = [
  f('A1', '2026-10-05', 'Migros', 1753.14, 160),
  f('A2', '2026-10-28', 'amazon', 10312.51, 1718.75),
  f('A3', '2026-10-28', 'Şok Market', 149, undefined),
  f('A4', '2026-10-01', 'İkea', 5938, 989.67),
];
const sira = (key: Parameters<typeof sortEFaturalar>[1]) => sortEFaturalar(list, key).map((x) => x.belgeNo);

describe('e-Fatura sıralama', () => {
  it('tarih: yeni → eski (aynı günde belge no) ve tersi', () => {
    assert.deepEqual(sira('yeni'), ['A3', 'A2', 'A1', 'A4']);
    assert.deepEqual(sira('eski'), ['A4', 'A1', 'A2', 'A3']);
  });

  it('tutar ve KDV (KDV bilgisi olmayan sona)', () => {
    assert.deepEqual(sira('tutar-yuksek'), ['A2', 'A4', 'A1', 'A3']);
    assert.deepEqual(sira('tutar-dusuk'), ['A3', 'A1', 'A4', 'A2']);
    assert.deepEqual(sira('kdv-yuksek'), ['A2', 'A4', 'A1', 'A3']);
  });

  it('firma: Türkçe alfabe, büyük/küçük harf duyarsız', () => {
    assert.deepEqual(sira('firma'), ['A2', 'A4', 'A1', 'A3']);
  });

  it('girdi listesi değişmez; geçersiz anahtar tanınmaz', () => {
    sortEFaturalar(list, 'tutar-dusuk');
    assert.equal(list[0]!.belgeNo, 'A1');
    assert.equal(isEFaturaSort('firma'), true);
    assert.equal(isEFaturaSort('xyz'), false);
  });
});
