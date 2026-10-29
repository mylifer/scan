// Canlı Supabase'de uçtan uca deneme (GitHub Actions'tan çalışır, bkz. .github/workflows/smoke-test.yml):
// geçici bir test kullanıcısı açar → fiş fotoğrafını sunucu fonksiyonuyla okutur → yeni alanlarla fiş,
// kendi kategorisi ve hata kaydı yazıp okur → test kullanıcısını (verileriyle birlikte) siler.
import { readFileSync } from 'node:fs';

import { parseGibQr } from '../src/lib/gibQr';
import { parseReceiptJson } from '../src/services/vision/parseReceiptJson';
import { RECEIPT_USER_PROMPT, receiptJsonSchema, receiptSystemPrompt } from '../src/services/vision/receiptPrompt';

const URL_ = process.env.SUPABASE_URL!;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY!;
const ADMIN = process.env.SUPABASE_ADMIN_KEY!;
const IMAGE = process.env.IMAGE ?? 'e2e/fixtures/fis.jpg';
const PDF = process.env.PDF ?? 'e2e/fixtures/fatura.pdf';

const adminHeaders: Record<string, string> = { apikey: ADMIN, 'Content-Type': 'application/json' };
if (ADMIN.startsWith('ey')) adminHeaders.Authorization = `Bearer ${ADMIN}`;

let failures = 0;
function check(ok: boolean, label: string, detail?: unknown) {
  console.log(`${ok ? '✔' : '✖'} ${label}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { apikey: PUBLISHABLE, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${URL_}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // metin kalır
  }
  return { status: res.status, body: body as any };
}

async function main() {
  const email = `smoke-${Date.now()}@example.invalid`;
  const password = `S${crypto.randomUUID()}!`;
  const created = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = (await created.json()) as { id?: string; msg?: string };
  if (!user.id) throw new Error(`Test kullanıcısı açılamadı: ${created.status} ${JSON.stringify(user)}`);
  console.log('Test kullanıcısı açıldı');
  try {
    const login = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
    const token = login.body?.access_token as string | undefined;
    if (!token) throw new Error(`Giriş yapılamadı: ${login.status}`);

    // 1) Girişsiz çağrı reddedilmeli
    const anon = await call('/functions/v1/analyze-receipt', { method: 'POST', body: '{}' });
    check(anon.status === 401, 'Girişsiz fonksiyon çağrısı reddedildi', anon.status);

    // 2) Fiş okuma (uygulamanın gönderdiği istem ve şemayla)
    const image = readFileSync(IMAGE).toString('base64');
    const started = Date.now();
    const read = await call('/functions/v1/analyze-receipt', {
      method: 'POST',
      token,
      body: JSON.stringify({ image, mimeType: 'image/jpeg', system: receiptSystemPrompt(), user: RECEIPT_USER_PROMPT, schema: receiptJsonSchema() }),
    });
    check(read.status === 200 && typeof read.body?.text === 'string', `Fonksiyon fişi okudu (${read.body?.model ?? '?'}, ${((Date.now() - started) / 1000).toFixed(1)} sn)`, read.status === 200 ? undefined : read.body);
    if (read.status === 200) {
      const d = parseReceiptJson(read.body.text);
      console.log('Okunan:', JSON.stringify(d));
      check(/M[İI]GROS/i.test(d.firmaAdi), 'Firma', d.firmaAdi);
      check(d.tarih === '14.09.2026', 'Tarih', d.tarih);
      check(d.toplamTutar === 337.3, 'Toplam', d.toplamTutar);
      check(Math.abs(d.kdvYuzde1 - 0.57) < 0.01 && Math.abs(d.kdvYuzde20 - 46.63) < 0.01, 'KDV dilimleri', [d.kdvYuzde1, d.kdvYuzde10, d.kdvYuzde20]);
      check((d.fisNo ?? '').replace(/^0+/, '') === '42', 'Fiş no', d.fisNo);
      check(d.vkn === '6220529513', 'VKN', d.vkn);
    }

    // 2b) e-Arşiv fatura PDF'i (satıcının VKN'si seçilmeli, alıcının TCKN'si değil)
    const pdf = readFileSync(PDF).toString('base64');
    const readPdf = await call('/functions/v1/analyze-receipt', {
      method: 'POST',
      token,
      body: JSON.stringify({ image: pdf, mimeType: 'application/pdf', system: receiptSystemPrompt(), user: RECEIPT_USER_PROMPT, schema: receiptJsonSchema() }),
    });
    check(readPdf.status === 200 && typeof readPdf.body?.text === 'string', 'Fonksiyon PDF faturayı okudu', readPdf.status === 200 ? undefined : readPdf.body);
    if (readPdf.status === 200) {
      const f = parseReceiptJson(readPdf.body.text);
      console.log('PDF:', JSON.stringify(f));
      check(/OPET/i.test(f.firmaAdi), 'PDF firma (satıcı)', f.firmaAdi);
      check(f.tarih === '15.09.2026', 'PDF tarih', f.tarih);
      check(f.toplamTutar === 1200, 'PDF ödenecek tutar', f.toplamTutar);
      check(f.kdvYuzde20 === 200 && f.kdvYuzde1 === 0 && f.kdvYuzde10 === 0, 'PDF KDV', [f.kdvYuzde1, f.kdvYuzde10, f.kdvYuzde20]);
      check(f.fisNo === 'OPT2026000000123', 'PDF fatura no', f.fisNo);
      check(f.vkn === '3900383669', 'PDF satıcı VKN (alıcı TCKN değil)', f.vkn);
    }

    // 2c) Karekod çözümü (sunucu gerekmez; yine de canlı denemede dursun)
    const qr = parseGibQr('{"vkntckn":"3900383669","tarih":"2026-09-15","no":"OPT2026000000123","hesaplanankdv(20)":"200","odenecek":"1200"}');
    check(qr?.toplamTutar === 1200 && qr.kdvYuzde20 === 200, 'Karekod çözüldü', qr);

    // 3) Yeni alanlar ve kendi kategorisiyle fiş kaydı (006 kurulumu)
    const cat = await call('/rest/v1/receipt_categories', { method: 'POST', token, headers: { Prefer: 'return=representation' }, body: JSON.stringify({ ad: 'Deneme Kategorisi' }) });
    check(cat.status === 201, 'Kendi kategorisi eklendi', cat.status === 201 ? undefined : cat.body);
    const ins = await call('/rest/v1/receipts', {
      method: 'POST',
      token,
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        firma_adi: 'DENEME',
        tarih: '2026-09-14',
        toplam_tutar: 337.3,
        kdv_yuzde1: 0.57,
        kdv_yuzde10: 0,
        kdv_yuzde20: 46.63,
        kategori: 'Deneme Kategorisi',
        fis_no: '0042',
        vkn: '6220529513',
        notlar: 'canlı deneme',
        etiketler: ['deneme', 'otomatik'],
      }),
    });
    const row = Array.isArray(ins.body) ? ins.body[0] : null;
    check(ins.status === 201 && row?.fis_no === '0042' && row?.etiketler?.length === 2, 'Fiş yeni alanlarla kaydedildi', ins.status === 201 ? undefined : ins.body);
    const badVkn = await call('/rest/v1/receipts', {
      method: 'POST',
      token,
      body: JSON.stringify({ firma_adi: 'X', tarih: '2026-09-14', toplam_tutar: 1, kategori: 'market', vkn: '12ab' }),
    });
    check(badVkn.status >= 400, 'Geçersiz VKN veritabanında reddedildi', badVkn.status);

    // 4) Hata kaydı
    const err = await call('/rest/v1/app_errors', { method: 'POST', token, body: JSON.stringify({ context: 'canlı deneme', message: 'deneme kaydı' }) });
    check(err.status === 201, 'Hata kaydı yazıldı', err.status === 201 ? undefined : err.body);
  } finally {
    // Test kullanıcısı silinince fişleri, kategorisi ve hata kaydı da silinir (on delete cascade)
    const del = await fetch(`${URL_}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: adminHeaders });
    check(del.ok, 'Test kullanıcısı ve verileri silindi', del.status);
  }
  if (failures) {
    console.log(`::error::${failures} kontrol başarısız`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.log(`::error::${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
