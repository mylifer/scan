// Taslaktan fiş kaydı: görsel yüklenemezse fotoğrafın tek kopyası olan taslak silinmez.
// Supabase depoları ve görsel hazırlama sahte modüllerle değiştirilir (--experimental-test-module-mocks).
import { mock, test } from 'node:test';
import assert from 'node:assert/strict';

const silinen = [];
let kayitlar = [];
let gorselHatasi = false;
mock.module('../services/supabase/draftsRepository.ts', {
  namedExports: {
    deleteDraft: async (d) => { silinen.push(d.id); },
    downloadDraftImage: async (p) => `local:${p}`,
  },
});
mock.module('../services/supabase/receiptsRepository.ts', {
  namedExports: {
    saveReceipt: async (data) => {
      kayitlar.push(data);
      return { record: { id: `r${kayitlar.length}` }, imageWarning: gorselHatasi ? 'Fiş görseli yüklenemedi: ağ hatası' : undefined };
    },
    findPossibleDuplicates: async (data) => kayitlar.filter((k) => k !== data && k.firmaAdi === data.firmaAdi && k.toplamTutar === data.toplamTutar),
  },
});
mock.module('../services/image/prepareReceiptImages.ts', {
  namedExports: { DRAFT_WIDTH: 1600, prepareArchiveImage: async (u) => `${u}:arsiv` },
});
mock.module('../services/supabase/storageFiles.ts', { namedExports: { releaseLocal: () => {} } });

const { approveDrafts, saveDraftAsReceipt } = await import('../services/drafts/bulkSave.ts');
const { emptyForm } = await import('../lib/receiptForm.ts');

const draft = (id) => ({ id, image_path: `u/drafts/${id}.jpg`, status: 'ready' });
const values = (firmaAdi) => ({ ...emptyForm(), firmaAdi, tarih: '15.10.2026', toplamTutar: '120,00', kdvYuzde20: '20,00' });

test('görsel yüklenemezse fiş kaydedilir ama taslak (fotoğraf) silinmez', async () => {
  gorselHatasi = true;
  const sonuc = await saveDraftAsReceipt(draft('t1'), { firmaAdi: 'Migros' });
  assert.equal(sonuc, 'gorselsiz');
  assert.deepEqual(silinen, []);
  gorselHatasi = false;
  assert.equal(await saveDraftAsReceipt(draft('t2'), { firmaAdi: 'A101' }), 'tamam');
  assert.deepEqual(silinen, ['t2']);
});

test('toplu onayda görselsiz kaydedilenler sayılır; tekrar onaylanırsa mükerrer olarak yakalanır', async () => {
  kayitlar = [];
  silinen.length = 0;
  gorselHatasi = true;
  const r = await approveDrafts([{ draft: draft('a'), values: values('Migros') }]);
  assert.deepEqual(r.saved, ['a']);
  assert.equal(r.imageMissing, 1);
  assert.equal(r.undeleted, 0);
  assert.deepEqual(silinen, [], 'taslak ve fotoğrafı duruyor');

  gorselHatasi = false;
  const tekrar = await approveDrafts([{ draft: draft('a'), values: values('Migros') }]);
  assert.deepEqual(tekrar.saved, []);
  assert.deepEqual(tekrar.skipped.map((s) => s.reason), ['mukerrer']);
  assert.equal(kayitlar.length, 1, 'çift kayıt oluşmaz');
});
