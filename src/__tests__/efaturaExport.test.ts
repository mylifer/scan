import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { strFromU8, unzipSync } from 'fflate';

import { buildEFaturaWorkbook } from '../services/efatura/efaturaWorkbook';
import type { EFatura } from '../services/efatura/qnbEfatura';

describe('efaturaWorkbook', () => {
  const ornekFaturalar: EFatura[] = [
    {
      ettn: 'fatura-1',
      belgeNo: 'GIB2026000000001',
      tarih: '2026-10-15',
      unvan: 'ABC Bilişim Ltd. Şti.',
      vkn: '1234567890',
      tutar: 1200,
      kdv: 200,
      matrah: 1000,
      paraBirimi: 'TRY',
      profil: 'TICARIFATURA',
      tur: 'efatura',
      tip: 'SATIS',
    },
    {
      ettn: 'fatura-2',
      belgeNo: 'EAR2026000000002',
      tarih: '2026-10-16',
      unvan: 'XYZ Danışmanlık A.Ş.',
      vkn: '9876543210',
      tutar: 600,
      kdv: 100,
      matrah: 500,
      paraBirimi: 'TRY',
      profil: 'EARSIVFATURA',
      tur: 'earsiv',
      tip: 'IADE',
    },
  ];

  it('geçerli bir xlsx dosyası (zip imzası PK..) üretir', () => {
    const bytes = buildEFaturaWorkbook(ornekFaturalar, 'Ekim 2026', 'gelen');
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 0);
    // Zip dosya başlığı imzası: 0x50, 0x4b, 0x03, 0x04 ("PK..")
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
    assert.equal(bytes[2], 0x03);
    assert.equal(bytes[3], 0x04);
  });

  it('boş fatura listesi için de geçerli dosya üretir', () => {
    const bytes = buildEFaturaWorkbook([], 'Ekim 2026', 'giden');
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 0);
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
  });

  it('toplam satırı iptal ve dövizli faturaları ₺ toplamına katmaz (satırlar listede kalır)', () => {
    const liste: EFatura[] = [
      ...ornekFaturalar,
      { ...ornekFaturalar[0]!, ettn: 'iptal', tutar: 5000, kdv: 900, matrah: 4100, iptal: true },
      { ...ornekFaturalar[0]!, ettn: 'usd', tutar: 70, kdv: 10, matrah: 60, paraBirimi: 'USD' },
    ];
    const sheet = strFromU8(unzipSync(buildEFaturaWorkbook(liste, 'Ekim 2026', 'gelen'))['xl/worksheets/sheet1.xml']);
    assert.ok(sheet.includes('iptal') && sheet.includes('usd'), 'tüm satırlar listelenir');
    assert.match(sheet, /<f>SUMIFS\(I4:I7,J4:J7,&quot;TRY&quot;,K4:K7,&quot;Geçerli&quot;\)<\/f><v>1800<\/v>/);
    assert.match(sheet, /<f>SUMIFS\(H4:H7,[^<]*<\/f><v>300<\/v>/);
  });
});
