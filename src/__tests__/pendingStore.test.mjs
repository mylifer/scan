// iPhone'a özel kalıcı yükleme listesi: expo-file-system ve AsyncStorage sahte modüllerle değiştirilir
// (node --experimental-test-module-mocks; package.json test betiğinde)
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const files = new Map(); // uri -> true
const store = new Map();
class Directory { constructor(base, name) { this.uri = `${base}/${name}`; } get exists() { return true; } create() {} }
class File {
  constructor(a, b) { this.uri = b ? `${a.uri ?? a}/${b}` : a; }
  get exists() { return files.has(this.uri); }
  async copy(target) { if (!files.has(this.uri)) throw new Error('kaynak yok'); files.set(target.uri, true); }
  delete() { files.delete(this.uri); }
}
mock.module('expo-file-system', { namedExports: { Directory, File, Paths: { document: 'doc:' } } });
mock.module('@react-native-async-storage/async-storage', { defaultExport: {
  getItem: async (k) => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); } } });

const s = await import('../services/drafts/pendingStore.ts');

test('kopyalar, listeler, siler', async () => {
  files.set('cache:/a.jpg', true);
  const p = await s.persistPhoto('cache:/a.jpg', 3000, 'u1');
  assert.ok(p && p.uri.startsWith('doc:/pending-uploads/') && files.has(p.uri));
  files.delete('cache:/a.jpg'); // önbellek temizlense de kalıcı kopya duruyor
  assert.equal((await s.loadPending('u1')).length, 1);
  assert.equal((await s.loadPending('u2')).length, 0, 'başka kullanıcıya gösterilmez');
  await s.removePending(p.key);
  assert.equal((await s.loadPending('u1')).length, 0);
  assert.ok(!files.has(p.uri), 'dosya silinir');
});

test('3 başarısız denemeden sonra bırakılır', async () => {
  files.set('cache:/b.jpg', true);
  const p = await s.persistPhoto('cache:/b.jpg', 1000, 'u1');
  assert.equal(await s.markFailed(p.key), false);
  assert.equal(await s.markFailed(p.key), false);
  assert.equal(await s.markFailed(p.key), true);
  assert.equal((await s.loadPending('u1')).length, 0);
});

test('kaynak dosya yoksa null (yükleme özgün dosyayla sürer)', async () => {
  assert.equal(await s.persistPhoto('cache:/yok.jpg', 1, 'u1'), null);
});

test('dosyası kaybolan kayıt temizlenir; art arda eklemelerde kayıp yok', async () => {
  for (const n of ['c', 'd', 'e']) files.set(`cache:/${n}.jpg`, true);
  const ps = await Promise.all(['c', 'd', 'e'].map((n) => s.persistPhoto(`cache:/${n}.jpg`, 1, 'u1')));
  assert.equal((await s.loadPending('u1')).length, 3, 'eşzamanlı eklemelerin hepsi kayıtlı');
  files.delete(ps[0].uri);
  assert.equal((await s.loadPending('u1')).length, 2);
});
