// Aylık bütçe kullanıcıya özel saklanır; aynı telefonda başka hesap öncekinin bütçesini görmez.
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
mock.module('@react-native-async-storage/async-storage', {
  defaultExport: {
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => { store.set(k, v); },
    removeItem: async (k) => { store.delete(k); },
  },
});

const b = await import('../lib/budget.ts');

test('eski kayıt ilk kullanıcıya taşınır; başka kullanıcı görmez; çıkışta gizlenir', async () => {
  store.set('budget:monthly', '30000');
  await b.setBudgetOwner('a');
  assert.equal(store.get('budget:monthly:a'), '30000');
  assert.equal(store.has('budget:monthly'), false);

  await b.setBudgetOwner('b');
  await b.setMonthlyBudget(12000);
  assert.equal(store.get('budget:monthly:b'), '12000');
  assert.equal(store.get('budget:monthly:a'), '30000', 'a kullanıcısının bütçesi değişmez');

  await b.setBudgetOwner(null);
  await b.setMonthlyBudget(5000);
  assert.equal(store.get('budget:monthly:b'), '12000', 'oturum yokken kayıt yazılmaz');
});
