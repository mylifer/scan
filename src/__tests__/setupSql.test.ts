import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { CATEGORIES_SETUP_SQL } from '../lib/setupSql';
import { KATEGORILER } from '../types/receipt';

describe('kurulum kodları', () => {
  it('kategori kurulumu migration dosyasıyla aynı', () => {
    const file = readFileSync(new URL('../../supabase/migrations/003_more_categories.sql', import.meta.url), 'utf8');
    assert.ok(file.endsWith(CATEGORIES_SETUP_SQL));
  });

  it('uygulamadaki her kategori veritabanı kuralında var', () => {
    for (const k of KATEGORILER) assert.ok(CATEGORIES_SETUP_SQL.includes(`'${k}'`), k);
  });
});
