import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { EXTRAS_SETUP_SQL, TRASH_SETUP_SQL } from '../lib/setupSql';

describe('kurulum kodları', () => {
  it('006 kurulumu migration dosyasıyla aynı', () => {
    const file = readFileSync(new URL('../../supabase/migrations/006_receipt_extras.sql', import.meta.url), 'utf8');
    assert.ok(file.endsWith(EXTRAS_SETUP_SQL));
  });

  it('006 tek başına yeterli: yeni alanlar, kendi kategorileri, hata kayıtları ve çöp kutusu', () => {
    for (const part of ['fis_no', 'vkn', 'notlar', 'etiketler', 'receipt_categories', 'app_errors', 'receipt_trash', 'select 6']) {
      assert.ok(EXTRAS_SETUP_SQL.includes(part), part);
    }
    // Kategori artık sabit listeyle sınırlı değil (kendi kategorileri kaydedilebilsin)
    assert.ok(!/kategori in \(/.test(EXTRAS_SETUP_SQL));
  });

  it('çöp kutusu kurulumu migration dosyasıyla aynı', () => {
    const file = readFileSync(new URL('../../supabase/migrations/005_receipt_trash.sql', import.meta.url), 'utf8');
    assert.ok(file.endsWith(TRASH_SETUP_SQL));
    assert.ok(TRASH_SETUP_SQL.includes('select 5'));
  });
});
