// Süresi dolan çöp kayıtları en eskiden başlayarak silinir; çöp listesinin (son 1000) dışındakiler de.
// Silme istekleri parça parça gider (adres sınırı).
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

mock.module('expo-file-system', { namedExports: { File: class {} } });
mock.module('react-native', { namedExports: { Platform: { OS: 'web' } } });
mock.module('../services/supabase/schema.ts', { namedExports: { trashReady: async () => true } });

// 1200 süresi dolmuş kayıt (en eskisi en başta)
let trash = Array.from({ length: 1200 }, (_, i) => ({ id: `t${String(i).padStart(4, '0')}`, deleted_at: `2025-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`, receipt: {} }));
const deleteCalls = [];
let selectOrder = null;

function builder(table) {
  const q = { table, op: 'select', filters: {} };
  const api = {
    select() { return api; },
    lt() { return api; },
    order(col, opts) { selectOrder = opts; return api; },
    limit(n) { q.limit = n; return api; },
    delete() { q.op = 'delete'; return api; },
    in(col, vals) { q.in = vals; return api; },
    then(resolve) {
      if (table === 'receipt_trash' && q.op === 'select') return resolve({ data: trash.slice(0, q.limit).map((t) => ({ id: t.id })), error: null });
      if (table === 'receipt_trash' && q.op === 'delete') {
        deleteCalls.push(q.in.length);
        const gone = trash.filter((t) => q.in.includes(t.id));
        trash = trash.filter((t) => !q.in.includes(t.id));
        return resolve({ data: gone, error: null });
      }
      return resolve({ data: [], error: null });
    },
  };
  return api;
}
mock.module('../services/supabase/client.ts', {
  namedExports: { supabase: { from: builder, storage: { from: () => ({ remove: async () => ({}) }) } } },
});

const repo = await import('../services/supabase/receiptsRepository.ts');

test('süresi dolanlar en eskiden başlayarak, çöp listesi sınırına takılmadan silinir', async () => {
  const n = await repo.purgeExpiredTrash();
  assert.equal(n, 1000, 'bir açılışta en çok 1000 kayıt');
  assert.deepEqual(selectOrder, { ascending: true });
  assert.equal(trash.length, 200);
  assert.equal(trash[0].id, 't1000', 'kalanlar en yeniler');
  assert.ok(deleteCalls.every((c) => c <= 100), 'silme istekleri 100 kimlikle sınırlı');
  assert.equal(await repo.purgeExpiredTrash(), 200, 'sonraki açılışta kalanlar silinir');
});
