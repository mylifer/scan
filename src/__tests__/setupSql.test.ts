import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { CATEGORIES_SETUP_SQL, TRASH_SETUP_SQL } from '../lib/setupSql';
import { KATEGORILER } from '../types/receipt';

describe('kurulum kodları', () => {
  it('kategori kurulumu migration dosyasıyla aynı', () => {
    const file = readFileSync(new URL('../../supabase/migrations/004_giyim_category.sql', import.meta.url), 'utf8');
    assert.ok(file.endsWith(CATEGORIES_SETUP_SQL));
  });

  it('çöp kutusu kurulumu migration dosyasıyla aynı ve kategorileri de kapsar', () => {
    const file = readFileSync(new URL('../../supabase/migrations/005_receipt_trash.sql', import.meta.url), 'utf8');
    assert.ok(file.endsWith(TRASH_SETUP_SQL));
    assert.ok(TRASH_SETUP_SQL.includes('select 5'));
    for (const k of KATEGORILER) assert.ok(TRASH_SETUP_SQL.includes(`'${k}'`), k);
  });

  it('uygulamadaki her kategori veritabanı kuralında var', () => {
    for (const k of KATEGORILER) assert.ok(CATEGORIES_SETUP_SQL.includes(`'${k}'`), k);
  });
});
