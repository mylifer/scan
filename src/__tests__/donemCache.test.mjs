// Çıkışta e-Fatura önbellekleri temizlenir; kalıcı kayıtlar kullanıcıya göre ayrılır.
// AsyncStorage, Supabase istemcisi ve QNB çağrısı sahte modüllerle değiştirilir (--experimental-test-module-mocks).
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
mock.module('@react-native-async-storage/async-storage', {
  defaultExport: {
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => { store.set(k, v); },
    getAllKeys: async () => [...store.keys()],
    multiRemove: async (keys) => { for (const k of keys) store.delete(k); },
  },
});
let uid = 'kullanici-a';
mock.module('../services/supabase/client.ts', {
  namedExports: { supabase: { auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null } }) }, functions: {} } },
});
class EFaturaError extends Error {
  constructor(m, loginFailed = false) { super(m); this.loginFailed = loginFailed; }
}
let sonraki = async () => ({ faturalar: [{ ettn: 'a-1', tutar: 100 }] });
mock.module('../services/efatura/qnbEfatura.ts', {
  namedExports: { EFaturaError, listEFaturalar: () => sonraki() },
});

const c = await import('../services/efatura/donemCache.ts');
const pdf = await import('../services/efatura/pdfCache.ts');
const bekle = () => new Promise((r) => setTimeout(r, 0));

test('çıkışta bellek, PDF ve telefondaki dönemler silinir; QNB giriş durumu sıfırlanır', async () => {
  await c.donemGetir('gelen', '2026-10-01', '2026-10-31');
  await bekle();
  assert.equal(c.donemCache.size, 1);
  assert.ok([...store.keys()].some((k) => k.includes('kullanici-a')), 'kalıcı kayıt kullanıcıya göre');
  store.set('efatura-donem:v1:gelen:2026-09-01', '{}');
  store.set('efatura-ozet:v1', '{}');
  store.set('baska-ayar', '1');
  pdf.setCachedPdf('gelen', 'a-1', { base64: '', bytes: new Uint8Array() });
  c.qnbDurum.loginFailed = true;

  await c.efaturaOnbellekleriniTemizle();
  assert.equal(c.donemCache.size, 0);
  assert.equal(c.qnbDurum.loginFailed, false);
  assert.equal(pdf.isPdfCached('gelen', 'a-1'), false);
  assert.deepEqual([...store.keys()], ['baska-ayar']);
  uid = 'kullanici-b';
  assert.equal(await c.kaliciDonemOku('gelen', '2026-10-01'), null);
});

test('başka kullanıcı öncekinin kalıcı kaydını okuyamaz', async () => {
  uid = 'kullanici-a';
  await c.donemGetir('giden', '2026-08-01', '2026-08-31');
  await bekle();
  c.donemCache.clear(); // uygulama yeniden açıldı
  assert.equal((await c.kaliciDonemOku('giden', '2026-08-01'))?.donem.faturalar[0].ettn, 'a-1');
  uid = 'kullanici-b';
  assert.equal(await c.kaliciDonemOku('giden', '2026-08-01'), null);
});

test('çıkıştan önce başlayan isteğin sonucu önbelleğe yazılmaz', async () => {
  uid = 'kullanici-a';
  let bitir;
  sonraki = () => new Promise((r) => { bitir = r; });
  const p = c.donemGetir('gelen', '2026-07-01', '2026-07-31');
  await bekle();
  await c.efaturaOnbellekleriniTemizle();
  uid = 'kullanici-b';
  bitir({ faturalar: [{ ettn: 'a-2', tutar: 1 }] });
  await p;
  await bekle();
  assert.equal(c.donemCache.size, 0);
  assert.deepEqual([...store.keys()], ['baska-ayar']);
});
