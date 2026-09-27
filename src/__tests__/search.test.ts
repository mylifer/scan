import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { matchesReceipt, normalizeForSearch } from '../lib/search';

const migros = { firma_adi: 'MİGROS TİCARET A.Ş.', toplam_tutar: 337.3 };
const opet = { firma_adi: 'OPET PETROLCÜLÜK', toplam_tutar: 1500 };

describe('arama', () => {
  it('Türkçe harflerden bağımsız', () => {
    assert.equal(normalizeForSearch('  MİGROS   Şube '), 'migros sube');
    assert.ok(matchesReceipt(migros, 'migros'));
    assert.ok(matchesReceipt(migros, 'ticaret'));
    assert.ok(matchesReceipt(opet, 'petrolculuk'));
  });
  it('boş sorgu hepsiyle eşleşir', () => assert.ok(matchesReceipt(opet, '  ')));
  it('tutarla arar', () => {
    assert.ok(matchesReceipt(migros, '337'));
    assert.ok(matchesReceipt(migros, '337,3'));
    assert.ok(matchesReceipt(migros, '337.30'));
    assert.ok(matchesReceipt(opet, '1.500'));
    assert.ok(matchesReceipt(opet, '1500'));
    assert.ok(!matchesReceipt(opet, '337'));
  });
  it('eşleşmeyeni eler', () => assert.ok(!matchesReceipt(migros, 'shell')));
});
