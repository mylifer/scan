import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { photoFileNames } from '../services/export/packageNames';

describe('paket dosya adları', () => {
  it('tarih_firma_tutar biçimi ve tekrarlarda ek', () => {
    const names = photoFileNames([
      { id: 'a', tarih: '2026-09-14', firma_adi: 'MİGROS TİCARET A.Ş.', toplam_tutar: 337.3 },
      { id: 'b', tarih: '2026-09-14', firma_adi: 'Migros Ticaret AŞ', toplam_tutar: 337.3 },
      { id: 'c', tarih: '2026-09-14', firma_adi: '', toplam_tutar: 5 },
    ]);
    assert.equal(names.get('a'), '2026-09-14_migros-ticaret-as_337,30.jpg');
    assert.equal(names.get('b'), '2026-09-14_migros-ticaret-as_337,30-2.jpg');
    assert.equal(names.get('c'), '2026-09-14_fis_5,00.jpg');
  });
});
