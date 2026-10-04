// Uçtan uca (tarayıcı) duman testleri. Kullanım: npm run test:e2e
// Önce web sürümü e2e ayarlarıyla dist-e2e/ klasörüne derlenir (package.json betiği), sonra bu dosya
// sahte Supabase/Gemini ile ana akışları dener. Playwright gerekir (NODE_PATH ile ya da kurulu olarak).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { unzipSync, strFromU8 } = require('fflate');

const { isoDate, receipt, installBackend, session } = require('./mockBackend.cjs');
const { startServer } = require('./server.cjs');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright bulunamadı. Kurulu bir Playwright için NODE_PATH ayarlayın (ör. NODE_PATH=$(npm root -g)).');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..', 'dist-e2e');
const PORT = 8799;
const APP = `http://localhost:${PORT}/scan/`;
const PHOTO = fs.readFileSync(path.join(__dirname, 'fixtures', 'fis.jpg'));
const EXECUTABLE = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

async function open(browser, opts, urlSuffix = '') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const backend = await installBackend(page, { photo: PHOTO, ...opts });
  await page.goto(APP + urlSuffix, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  return { page, backend, errors, close: () => context.close() };
}

const thisMonth = () => [
  receipt('a', 'MİGROS TİCARET A.Ş.', isoDate(0, 1), 337.3, { image_path: 'u/a.jpg' }),
  receipt('b', 'OPET PETROLCÜLÜK A.Ş.', isoDate(0, 1), 1500, { kategori: 'akaryakıt', image_path: 'u/b.jpg' }),
  receipt('c', 'KÖFTECİ YUSUF', isoDate(-1, 10), 420, { kategori: 'restoran' }),
  receipt('d', 'ESKİ AY FİRMASI', isoDate(-2, 5), 77),
];

test('ana sayfa bu ayın fişlerini ve toplamını gösterir', async (b) => {
  const { page, errors, close } = await open(b, { receipts: thisMonth() });
  const text = await page.locator('body').innerText();
  assert.ok(text.includes('MİGROS TİCARET A.Ş.') && text.includes('OPET PETROLCÜLÜK A.Ş.'), 'bu ayın fişleri görünmeli');
  assert.ok(!text.includes('KÖFTECİ YUSUF'), 'geçen ayın fişi görünmemeli');
  assert.ok(text.includes('1.837,30'), 'toplam 1.837,30 olmalı');
  assert.deepEqual(errors, []);
  await close();
});

test('öne çıkanlar: önceki ayla kategori kıyası', async (b) => {
  const { page, errors, close } = await open(b, { receipts: thisMonth() });
  const text = await page.locator('body').innerText();
  assert.ok(text.includes('ÖNE ÇIKANLAR'), 'özet bölümü görünmeli');
  assert.ok(text.includes('Akaryakıt harcaması geçen ay yoktu'), 'yeni kategori söylenmeli');
  assert.ok(!text.includes('En çok harcama'), 'her firmanın tek fişi varken firma cümlesi yok');
  assert.deepEqual(errors, []);
  await close();
});

test('bildirimden gelen ?ay= bağlantısı o ayın özetini açar', async (b) => {
  const prev = isoDate(-1, 10).slice(0, 7);
  const { page, errors, close } = await open(b, { receipts: thisMonth() }, `?ay=${prev}`);
  const text = await page.locator('body').innerText();
  assert.ok(text.includes('KÖFTECİ YUSUF'), 'geçen ayın fişi görünmeli');
  assert.ok(!text.includes('OPET PETROLCÜLÜK A.Ş.'), 'bu ayın fişi görünmemeli');
  assert.ok(!page.url().includes('ay='), 'parametre temizlenmeli');
  assert.deepEqual(errors, []);
  await close();
});

test('hızlı ay geçişinde geç dönen eski istek listeyi ezmez', async (b) => {
  const lastMonthFrom = isoDate(-1, 1);
  const { page, errors, close } = await open(b, {
    receipts: thisMonth(),
    delay: (url) => (url.searchParams.getAll('tarih').includes(`gte.${lastMonthFrom}`) ? 2500 : 0),
  });
  await page.getByLabel('Önceki ay').click();
  await page.waitForTimeout(500);
  await page.getByLabel('Önceki ay').click();
  await page.waitForTimeout(3500);
  const text = await page.locator('body').innerText();
  assert.ok(text.includes('ESKİ AY FİRMASI'), 'iki ay önceki fiş görünmeli');
  assert.ok(!text.includes('KÖFTECİ YUSUF'), 'geç dönen geçen ay isteği listeyi ezmemeli');
  assert.deepEqual(errors, []);
  await close();
});

test('arama ve tüm zamanlarda arama kısayolu', async (b) => {
  const { page, close } = await open(b, { receipts: thisMonth() });
  await page.getByPlaceholder('Firma ya da tutar ara').fill('köfte');
  await page.waitForTimeout(400);
  await page.getByText('Tüm Zamanlarda Ara').click();
  await page.waitForTimeout(1200);
  assert.equal(await page.getByText('KÖFTECİ YUSUF').count(), 1);
  await close();
});

test('elle fiş ekleme: kaydetmeden çıkış sorulur, kaydedince sorulmaz', async (b) => {
  const { page, backend, errors, close } = await open(b, { receipts: [] });
  await page.getByText('Elle', { exact: true }).click();
  await page.waitForTimeout(800);
  await page.locator('input[placeholder="Firma adı"]').fill('TEST LTD');
  await page.getByText('Vazgeç', { exact: true }).first().click();
  await page.waitForTimeout(600);
  assert.equal(await page.getByText('Kaydetmeden Çık').count(), 1, 'kaydedilmemiş değişiklik sorusu çıkmalı');
  await page.getByText('Vazgeç', { exact: true }).last().click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder="0,00"]').nth(0).fill('1.250');
  await page.getByText('Kaydet', { exact: true }).click();
  await page.waitForTimeout(1500);
  const saved = backend.db.receipts.find((r) => r.firma_adi === 'TEST LTD');
  assert.ok(saved, 'fiş kaydedilmeli');
  assert.equal(saved.toplam_tutar, 1250, '"1.250" bin iki yüz elli okunmalı');
  assert.equal(await page.getByText('Kaydetmeden Çık').count(), 0);
  assert.deepEqual(errors, []);
  await close();
});

test('aylık bütçe: "15.000" on beş bin olarak kaydedilir', async (b) => {
  const { page, close } = await open(b, { receipts: thisMonth() });
  await page.getByLabel('Ayarlar').click();
  await page.waitForTimeout(800);
  await page.getByText('Aylık Bütçe').click();
  await page.waitForTimeout(800);
  await page.keyboard.type('15.000');
  await page.getByText('Kaydet', { exact: true }).click();
  await page.waitForTimeout(800);
  // Ayarlar modalı ve arkadaki ana sayfa (bütçe çubuğu) aynı tutarı gösterir
  assert.ok((await page.getByText('₺15.000,00').count()) >= 1, '₺15.000,00 görünmeli');
  assert.equal(await page.getByText('₺15,00', { exact: true }).count(), 0, '15 TL olarak kaydedilmemeli');
  await close();
});

test('vergi takvimi: önümüzdeki son günler, muhtasar isteğe bağlı', async (b) => {
  const { page, errors, close } = await open(b, { receipts: thisMonth() });
  await page.getByLabel('Ayarlar').click();
  await page.waitForTimeout(800);
  await page.getByText('Vergi Takvimi').click();
  await page.waitForTimeout(800);
  const text = await page.locator('body').innerText();
  assert.ok(text.includes('KDV beyannamesi ve ödemesi'), 'KDV son günleri görünmeli');
  assert.ok(text.includes('Geçici vergi beyannamesi ve ödemesi'), 'geçici vergi görünmeli');
  assert.ok(text.includes('VUK 18'), 'tatil kayması açıklaması görünmeli');
  assert.equal(await page.getByText('Muhtasar ve prim hizmet beyannamesi').count(), 0, 'muhtasar varsayılan gizli');
  await page.getByRole('switch').click();
  await page.waitForTimeout(400);
  assert.ok((await page.getByText('Muhtasar ve prim hizmet beyannamesi').count()) >= 11, 'açılınca 12 ayın muhtasarı görünmeli');
  assert.deepEqual(errors, []);
  await close();
});

test('firma adları: farklı yazımlar tek ada birleştirilir', async (b) => {
  const { page, backend, errors, close } = await open(b, {
    receipts: [
      ...thisMonth(),
      receipt('m2', 'Migros', isoDate(0, 1), 50),
      receipt('m3', 'MIGROS', isoDate(-1, 3), 60),
    ],
  });
  await page.getByLabel('Ayarlar').click();
  await page.waitForTimeout(800);
  await page.getByText('Firma Adlarını Birleştir').click();
  await page.waitForTimeout(1200);
  assert.ok((await page.getByText('1 firmada farklı yazım bulundu').count()) === 1);
  await page.getByText('Birleştir (2 fiş)').click();
  await page.waitForTimeout(1500);
  const names = new Set(backend.db.receipts.filter((r) => r.id.startsWith('m') || r.id === 'a').map((r) => r.firma_adi));
  assert.deepEqual([...names], ['MİGROS TİCARET A.Ş.'], 'hepsi tek ad olmalı');
  assert.ok((await page.getByText('Birleştirilecek Firma Yok').count()) === 1, 'liste boşalmalı');
  assert.deepEqual(errors, []);
  await close();
});

test('çöp kutusu: silinen fiş Son Silinenler’e gider, fotoğrafı korunur, geri alınır', async (b) => {
  const { page, backend, errors, close } = await open(b, { receipts: thisMonth(), schema: 5 });
  await page.getByText('OPET PETROLCÜLÜK A.Ş.').click();
  await page.waitForTimeout(1200);
  await page.getByText('Fişi Sil').first().click();
  await page.waitForTimeout(500);
  assert.ok((await page.getByText(/30 gün içinde Ayarlar’dan geri alabilirsiniz/).count()) === 1, 'onayda geri alınabilir denmeli');
  await page.getByText('Fişi Sil').last().click();
  await page.waitForTimeout(1500);
  assert.ok(!backend.db.receipts.some((r) => r.id === 'b'), 'fiş listeden çıkmalı');
  assert.equal(backend.db.receipt_trash.length, 1, 'çöp kutusuna taşınmalı');
  assert.ok(!backend.log.some((l) => l.startsWith('STORAGE DELETE')), 'fotoğraf silinmemeli');

  await page.getByLabel('Ayarlar').click();
  await page.waitForTimeout(800);
  await page.getByText('Son Silinenler', { exact: true }).click();
  await page.waitForTimeout(1200);
  assert.ok((await page.getByText(/30 gün kaldı/).count()) === 1);
  await page.getByText('OPET PETROLCÜLÜK A.Ş.').click();
  await page.waitForTimeout(400);
  await page.getByText('Geri Al', { exact: true }).click();
  await page.waitForTimeout(1500);
  const back = backend.db.receipts.find((r) => r.id === 'b');
  assert.ok(back, 'fiş geri gelmeli');
  assert.equal(back.image_path, 'u/b.jpg', 'fotoğraf bağlantısı korunmalı');
  assert.equal(backend.db.receipt_trash.length, 0);
  assert.ok((await page.getByText('Son Silinen Yok').count()) === 1);

  // Kalıcı silme: fotoğrafı başka fiş kullanmıyorsa o da silinir
  backend.db.receipt_trash.push({ id: 'z', deleted_at: new Date().toISOString(), receipt: { ...thisMonth()[0], id: 'z', image_path: 'u/z.jpg' } });
  backend.db.receipt_trash.push({ id: 'y', deleted_at: new Date().toISOString(), receipt: { ...thisMonth()[0], id: 'y', image_path: 'u/b.jpg' } });
  await page.goBack();
  await page.waitForTimeout(600);
  await page.getByText('Son Silinenler', { exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByText('Tümünü Sil').click();
  await page.waitForTimeout(300);
  await page.getByText('Tümünü Kalıcı Olarak Sil').click();
  await page.waitForTimeout(1500);
  assert.equal(backend.db.receipt_trash.length, 0);
  assert.ok(backend.log.includes('STORAGE DELETE 1'), `yalnızca sahipsiz fotoğraf silinmeli: ${backend.log.filter((l) => l.startsWith('STORAGE')).join(',')}`);
  assert.deepEqual(errors, []);
  await close();
});

test('toplu düzenleme: seçilen fişlerin kategorisi değişir, toplu silinir', async (b) => {
  const { page, backend, errors, close } = await open(b, { receipts: thisMonth(), schema: 5 });
  await page.getByText('Seç', { exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByText('MİGROS TİCARET A.Ş.').click();
  await page.getByText('OPET PETROLCÜLÜK A.Ş.').click();
  assert.ok((await page.getByText('Sil (2)').count()) === 1, 'seçim sayısı');
  await page.getByText('Kategori', { exact: true }).last().click();
  await page.waitForTimeout(300);
  await page.getByText('Ofis Gideri', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  const cats = backend.db.receipts.filter((r) => r.id === 'a' || r.id === 'b').map((r) => r.kategori);
  assert.deepEqual(cats, ['ofis gideri', 'ofis gideri']);
  assert.ok((await page.getByText('2 fiş Ofis Gideri yapıldı').count()) >= 1);

  await page.getByText('Seç', { exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByText('Tümünü Seç').click();
  await page.getByText('Sil (2)').click();
  await page.waitForTimeout(300);
  await page.getByText('2 Fişi Sil').click();
  await page.waitForTimeout(2000);
  assert.equal(backend.db.receipts.filter((r) => r.id === 'a' || r.id === 'b').length, 0, 'bu ayın fişleri silinmeli');
  assert.equal(backend.db.receipt_trash.length, 2, 'çöp kutusuna gitmeli');
  assert.equal(backend.db.receipts.length, 2, 'diğer ayların fişlerine dokunulmamalı');
  assert.deepEqual(errors, []);
  await close();
});

test('tüm fişler, firmalar ve firma detayı', async (b) => {
  const { page, errors, close } = await open(b, {
    receipts: [...thisMonth(), receipt('m2', 'Migros ', isoDate(-3, 4), 62.7, { kdv_yuzde10: 5.7, toplam_kdv: 5.7, kdv_yuzde20: 0 })],
  });
  await page.getByText('Tüm Fişler', { exact: true }).click();
  await page.waitForTimeout(1200);
  let text = await page.locator('body').innerText();
  for (const f of ['MİGROS TİCARET A.Ş.', 'OPET PETROLCÜLÜK A.Ş.', 'KÖFTECİ YUSUF', 'ESKİ AY FİRMASI']) assert.ok(text.includes(f), `${f} görünmeli`);
  assert.ok(text.includes('2.397,00'), 'tüm zamanların toplamı');
  await page.getByPlaceholder('Firma ya da tutar ara').last().fill('köfteci');
  await page.waitForTimeout(300);
  text = await page.locator('body').innerText();
  assert.ok(text.includes('KÖFTECİ YUSUF') && !text.includes('OPET PETROLCÜLÜK A.Ş.'), 'arama süzmeli');
  await page.goBack();
  await page.waitForTimeout(800);

  await page.getByText('Firmalar', { exact: true }).click();
  await page.waitForTimeout(1200);
  text = await page.locator('body').innerText();
  assert.ok(text.includes('FİRMALAR · 5') || text.includes('FİRMALAR · 4'), text.slice(0, 300));
  await page.getByRole('button', { name: /OPET PETROLCÜLÜK A\.Ş\. 1 fiş/ }).click();
  await page.waitForTimeout(1200);
  text = await page.locator('body').innerText();
  assert.ok(text.includes('Ortalama Fiş') && text.includes('₺1.500,00'), 'firma özeti');
  assert.ok(text.includes('TOPLAM KDV') || text.includes('Toplam KDV'), 'KDV dağılımı');
  assert.ok(text.includes('1 fiş'), 'fiş sayısı');
  // Firmanın fişine dokununca fiş detayı açılır
  await page.getByText('OPET PETROLCÜLÜK A.Ş.', { exact: true }).last().click();
  await page.waitForTimeout(1200);
  assert.ok((await page.getByText('Fişi Sil').count()) >= 1, 'fiş detayı açılmalı');
  assert.deepEqual(errors, []);
  await close();
});

test('muhasebe paketi geçerli bir ZIP üretir (Excel + fotoğraflar)', async (b) => {
  const { page, errors, close } = await open(b, { receipts: thisMonth() });
  const row = page.getByText('Muhasebe Paketi (ZIP)');
  await row.scrollIntoViewIfNeeded();
  const [download] = await Promise.all([page.waitForEvent('download'), row.click()]);
  const file = await download.path();
  const entries = unzipSync(fs.readFileSync(file));
  const names = Object.keys(entries);
  assert.equal(names.filter((n) => n.endsWith('.xlsx')).length, 1, 'bir Excel olmalı');
  assert.equal(names.filter((n) => n.startsWith('Fotograflar/')).length, 2, 'iki fotoğraf olmalı');
  const xlsx = unzipSync(entries[names.find((n) => n.endsWith('.xlsx'))]);
  assert.ok(strFromU8(xlsx['xl/workbook.xml']).includes('Fişler'));
  assert.deepEqual(errors, []);
  await close();
});

test('tam yedek: tüm fişler + fotoğraflar → başka hesaba geri yükleme, var olanlar atlanır', async (b) => {
  const a = await open(b, { receipts: thisMonth() });
  await a.page.getByLabel('Ayarlar').click();
  await a.page.waitForTimeout(800);
  const [download] = await Promise.all([a.page.waitForEvent('download'), a.page.getByText('Tam Yedek Al').click()]);
  // İndirilen dosya bağlam kapanınca silinir; ikinci hesap için kalıcı bir kopya
  const zipPath = path.join(require('node:os').tmpdir(), `e2e-yedek-${Date.now()}.zip`);
  await download.saveAs(zipPath);
  const entries = unzipSync(fs.readFileSync(zipPath));
  const manifest = JSON.parse(strFromU8(entries['yedek.json']));
  assert.equal(manifest.receipts.length, 4, 'tüm zamanların 4 fişi');
  assert.equal(Object.keys(entries).filter((n) => n.startsWith('fotograflar/')).length, 2, 'iki fotoğraf');
  assert.deepEqual(a.errors, []);
  await a.close();

  // Başka bir hesap: fişlerden biri zaten var
  const c = await open(b, { receipts: [thisMonth()[1]] });
  const dialogs = [];
  c.page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.accept();
  });
  await c.page.getByLabel('Ayarlar').click();
  await c.page.waitForTimeout(800);
  const [chooser] = await Promise.all([c.page.waitForEvent('filechooser'), c.page.getByText('Yedekten Geri Yükle').click()]);
  await chooser.setFiles(zipPath);
  await c.page.waitForTimeout(1200);
  assert.ok((await c.page.getByText('zaten olan 1 fiş atlanacak').count()) === 1, 'onayda atlanacak fiş sayısı');
  await c.page.getByText('3 Fişi Ekle').click();
  await c.page.waitForTimeout(2000);
  assert.equal(c.backend.db.receipts.length, 4, '3 fiş eklenmeli');
  const migros = c.backend.db.receipts.find((r) => r.firma_adi === 'MİGROS TİCARET A.Ş.');
  assert.ok(migros.image_path && c.backend.storage.has(migros.image_path), 'fotoğraf yeni hesaba yüklenmeli');
  assert.ok((await c.page.getByText('3 fiş geri yüklendi').count()) >= 1, 'başarı bildirimi');

  // Aynı yedek tekrar: eklenecek fiş yok
  const [again] = await Promise.all([c.page.waitForEvent('filechooser'), c.page.getByText('Yedekten Geri Yükle').click()]);
  await again.setFiles(zipPath);
  await c.page.waitForTimeout(1200);
  assert.ok(dialogs.some((m) => m.includes('Eklenecek fiş yok')), dialogs.join(' | '));
  assert.equal(c.backend.db.receipts.length, 4);
  assert.deepEqual(c.errors, []);
  await c.close();
  fs.rmSync(zipPath, { force: true });
});

test('toplu tarama: galeriden 3 fotoğraf → tara → incele → kaydet', async (b) => {
  const { page, backend, errors, close } = await open(b, { receipts: [] });
  await page.getByLabel('Toplu tarama').click();
  await page.waitForTimeout(1000);
  const photo = path.join(__dirname, 'fixtures', 'fis.jpg');
  await page.locator('input[multiple]').setInputFiles([photo, photo, photo]);
  await page.waitForTimeout(4000);
  assert.equal(backend.db.receipt_drafts.length, 3, '3 taslak oluşmalı');
  await page.getByText(/Şimdi Tara/).click();
  await page.waitForTimeout(12000); // istekler arası 4 sn bekleme
  assert.equal(backend.geminiCalls, 3);
  await page.getByText(/İncele ve Kaydet/).click();
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) {
    await page.getByText('Kaydet', { exact: true }).click();
    await page.waitForTimeout(2000);
  }
  assert.equal(backend.db.receipts.length, 3, '3 fiş kaydedilmeli');
  assert.equal(backend.db.receipt_drafts.length, 0, 'taslaklar silinmeli');
  assert.deepEqual(errors, []);
  await close();
});

test('okuma sürerken inceleme: hazır olan fişler sıraya eklenir, sonuncuya kadar beklenir', async (b) => {
  const { page, backend, errors, close } = await open(b, { receipts: [] });
  await page.getByLabel('Toplu tarama').click();
  await page.waitForTimeout(1000);
  const photo = path.join(__dirname, 'fixtures', 'fis.jpg');
  await page.locator('input[multiple]').setInputFiles([photo, photo, photo]);
  await page.waitForTimeout(4000);
  await page.getByText(/Şimdi Tara/).click();
  // İlk fiş okununca (istekler arası 4 sn) hemen incelemeye geç
  await page.getByText(/İncele ve Kaydet/).click({ timeout: 8000 });
  await page.waitForTimeout(1200);
  assert.ok(backend.geminiCalls < 3, 'diğerleri hâlâ okunuyor olmalı');
  await page.getByText('Kaydet', { exact: true }).click();
  await page.waitForTimeout(1500);
  // Sıradaki fiş okunurken bekleme ekranı ya da yeni gelen fiş görünür; hepsi gelene kadar kaydetmeye devam
  for (let i = 0; i < 2; i++) {
    await page.getByText('Kaydet', { exact: true }).click({ timeout: 15000 });
    await page.waitForTimeout(1500);
  }
  assert.equal(backend.db.receipts.length, 3, '3 fiş kaydedilmeli');
  assert.equal(backend.geminiCalls, 3);
  assert.deepEqual(errors, []);
  await close();
});

test('emin olunamayan alan turuncu işaretlenir, düzeltince işaret kalkar', async (b) => {
  const { page, errors, close } = await open(b, {
    receipts: [],
    gemini: () => ({ firmaAdi: 'SİLİK FİRMA', tarih: isoDate(0, 2).split('-').reverse().join('.'), toplamTutar: 100, kdvYuzde1: 0, kdvYuzde10: 0, kdvYuzde20: 16.67, kategori: 'market', eminOlunmayanlar: ['toplamTutar'] }),
  });
  await page.getByLabel('Toplu tarama').click();
  await page.waitForTimeout(1000);
  await page.locator('input[multiple]').setInputFiles([path.join(__dirname, 'fixtures', 'fis.jpg')]);
  await page.waitForTimeout(3000);
  await page.getByText(/Şimdi Tara/).click();
  await page.waitForTimeout(5000);
  await page.getByText(/İncele ve Kaydet/).click();
  await page.waitForTimeout(1500);
  assert.ok((await page.getByText(/Turuncu işaretli alan fişte net okunamadı/).count()) === 1, 'uyarı görünmeli');
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  const amount = page.locator('input[value="100,00"]');
  await amount.fill('120,00');
  await page.waitForTimeout(300);
  assert.equal(await page.getByText(/Turuncu işaretli/).count(), 0, 'düzeltilince uyarı kalkmalı');
  assert.deepEqual(errors, []);
  await close();
});

test('şifremi unuttum: sıfırlama e-postası web adresine yönlendirmeyle istenir', async (b) => {
  const { page, backend, close } = await open(b, { loggedOut: true });
  const dialogs = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.accept();
  });
  await page.getByText('Şifremi Unuttum').click();
  await page.waitForTimeout(400);
  assert.ok(dialogs.some((m) => m.includes('E-posta gerekli')), 'e-posta boşken uyarmalı');
  await page.getByPlaceholder('E-posta').fill('kisi@ornek.com');
  await page.getByText('Şifremi Unuttum').click();
  await page.waitForTimeout(1000);
  assert.ok(backend.log.some((l) => l.startsWith('RECOVER kisi@ornek.com https://mylifer.github.io/scan/')), backend.log.join(' | '));
  assert.ok(dialogs.some((m) => m.includes('E-postanızı kontrol edin')));
  await close();
});

test('sıfırlama bağlantısı: yeni şifre ekranı → kaydet → uygulamaya giriş', async (b) => {
  const s = session();
  const hash = `#access_token=${s.access_token}&refresh_token=r&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&type=recovery`;
  const { page, backend, errors, close } = await open(b, { loggedOut: true, receipts: thisMonth() }, hash);
  assert.equal(await page.getByText('Yeni Şifre', { exact: true }).count(), 1, 'yeni şifre ekranı açılmalı');
  await page.getByPlaceholder('Yeni şifre', { exact: true }).fill('yeni-sifre-123');
  await page.getByPlaceholder('Yeni şifre (tekrar)').fill('yeni-sifre-123');
  await page.getByText('Şifreyi Kaydet').click();
  await page.waitForTimeout(1500);
  assert.ok(backend.log.includes('PASSWORD updated'), backend.log.join(' | '));
  assert.equal(await page.getByText('Yeni Şifre', { exact: true }).count(), 0, 'kaydedince ana sayfaya geçmeli');
  assert.ok((await page.getByText('MİGROS TİCARET A.Ş.').count()) > 0, 'ana sayfa açılmalı');
  assert.deepEqual(errors, []);
  await close();
});

test('süresi dolmuş sıfırlama bağlantısı anlaşılır uyarı verir', async (b) => {
  const dialogs = [];
  const context = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.accept();
  });
  await installBackend(page, { loggedOut: true });
  await page.goto(`${APP}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  assert.ok(dialogs.some((m) => m.includes('Bağlantı geçersiz')), dialogs.join(' | '));
  assert.equal(await page.getByText('Giriş Yap').count() > 0, true, 'giriş ekranı açık kalmalı');
  await context.close();
});

(async () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'index.html')), 'Önce derleyin: npm run test:e2e');
  const server = await startServer(ROOT, PORT);
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  let failed = 0;
  for (const t of tests) {
    const started = Date.now();
    try {
      await t.fn(browser);
      console.log(`✔ ${t.name} (${Date.now() - started} ms)`);
    } catch (e) {
      failed++;
      console.log(`✖ ${t.name}\n  ${e.message.split('\n').join('\n  ')}`);
    }
  }
  await browser.close();
  server.close();
  console.log(`\n${tests.length - failed}/${tests.length} geçti`);
  process.exit(failed ? 1 : 0);
})();
