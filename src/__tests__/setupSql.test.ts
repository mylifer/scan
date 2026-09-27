import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { SCHEMA_SETUP_SQL } from '../lib/setupSql';
import { KATEGORILER } from '../types/receipt';

describe('kurulum kodları', () => {
  it('kategori kurulumu migration dosyasıyla aynı', () => {
    const file = readFileSync(new URL('../../supabase/migrations/005_receipt_details.sql', import.meta.url), 'utf8');
    assert.ok(file.endsWith(SCHEMA_SETUP_SQL));
  });

  it('uygulamadaki her kategori veritabanı kuralında var', () => {
    for (const k of KATEGORILER) assert.ok(SCHEMA_SETUP_SQL.includes(`'${k}'`), k);
  });

  it('yeni sütunları ekler', () => {
    for (const c of ['fis_no', 'vergi_no', 'odeme', 'notlar']) assert.ok(SCHEMA_SETUP_SQL.includes(`add column if not exists ${c}`), c);
    assert.ok(SCHEMA_SETUP_SQL.includes('select 5'));
  });
});
