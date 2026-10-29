// Supabase Edge Function: QNB eSolutions'tan gelen/giden e-faturaları listeler ve fatura detayını getirir
// (yalnızca okuma).
// QNB kullanıcı kodu, şifresi ve VKN sunucuda (Supabase secret) durur, uygulamaya girmez.
//
// Gerekli secret'lar: QNB_USER, QNB_PASS, QNB_VKN, QNB_ALLOWED_EMAILS (virgülle ayrılmış).
// QNB_ALLOWED_EMAILS boşsa kimse çağıramaz: faturalar tek bir firmaya ait, her giriş yapan görmesin.
//
// İstekler (POST):
//   { yon, baslangic: 'YYYY-MM-DD', bitis: 'YYYY-MM-DD' }  → { faturalar: EFatura[], uyari? }
//     giden: e-Fatura + e-Arşiv birlikte
//   { islem: 'detay', yon, ettn, tur? }                   → { detay: FaturaDetay }  (kalemler, KDV)
//   { islem: 'pdf', yon, ettn, tur? }                     → { pdf: base64 }
//     tur: 'earsiv' ise e-Arşiv servisinden (faturaSorgula), yoksa e-Fatura'dan (…BelgeIndirExt)
// Hata: { message, code? }  (code: 'qnb_login' → tekrar denemeyin)

import { unzipSync } from 'npm:fflate@0.8.2';

import {
  base64ToBytes,
  buildEnvelope,
  bytesToBase64,
  detailRequest,
  EARSIV_FORMAT,
  EARSIV_OK,
  EARSIV_URL,
  earsivDocInputs,
  EARSIV_PAGE,
  earsivListInput,
  ETTN_RE,
  type EFatura,
  extractFile,
  isLoginFault,
  listRequest,
  mergeLists,
  parseBase64Return,
  parseEarsivDoc,
  parseEarsivList,
  parseEarsivResult,
  parseFault,
  parseList,
  parseUbl,
  QNB_URL,
  type Yon,
} from './soap.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// Baştaki/sondaki boşluk ve satır sonu (ör. secret'a yapıştırırken gelen Enter) şifreyi bozmasın
const QNB_USER = (Deno.env.get('QNB_USER') ?? '').trim();
const QNB_PASS = (Deno.env.get('QNB_PASS') ?? '').trim();
const QNB_VKN = (Deno.env.get('QNB_VKN') ?? '').trim();
// Virgül, noktalı virgül, boşluk ya da satır sonuyla ayrılabilir; tırnak ve <> yok sayılır
const ALLOWED = (Deno.env.get('QNB_ALLOWED_EMAILS') ?? '')
  .split(/[\s,;]+/)
  .map((s) => s.replace(/["'<>]/g, '').trim().toLowerCase())
  .filter(Boolean);

/** En uzun sorgu aralığı (uygulama ay ay sorar) */
const MAX_DAYS = 62;
/** QNB giriş hatasından sonra bu süre boyunca QNB'ye hiç istek atılmaz (hesap kilitlenmesin) */
const LOGIN_COOLDOWN_MS = 15 * 60_000;
/** Hesap bloke ise daha uzun beklenir */
const BLOKE_COOLDOWN_MS = 60 * 60_000;
/** Servis başına (e-Fatura / e-Arşiv) giriş engeli bitiş zamanı */
const loginBlockedUntil = new Map<string, number>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Oturumun sahibinin e-postası (geçerli kullanıcı değilse null) */
async function userEmail(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!SUPABASE_URL || !/^Bearer\s+ey/i.test(auth)) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey } });
    if (!res.ok) return null;
    const user = await res.json().catch(() => null);
    if (typeof user?.id !== 'string' || user.role !== 'authenticated') return null;
    return typeof user.email === 'string' ? user.email.toLowerCase() : '';
  } catch {
    return null;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function validRange(a: unknown, b: unknown): a is string {
  if (typeof a !== 'string' || typeof b !== 'string' || !DATE_RE.test(a) || !DATE_RE.test(b)) return false;
  const days = (Date.parse(b) - Date.parse(a)) / 86_400_000;
  return Number.isFinite(days) && days >= 0 && days <= MAX_DAYS;
}

/** QNB girişi reddetti: bu istekte başka hiçbir QNB çağrısı yapılmaz */
class LoginError extends Error {}
/** QNB'nin iş hatası (parametre vb.) */
class QnbError extends Error {}

async function soap(url: string, op: string, params: Record<string, string>, opts: { earsiv?: boolean; wrap?: boolean } = {}): Promise<string> {
  if (Date.now() < (loginBlockedUntil.get(url) ?? 0)) {
    throw new LoginError('QNB girişi az önce başarısız oldu. Hesap kilitlenmesin diye bir süre yeniden denenmiyor.');
  }
  let xml: string;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body: buildEnvelope(op, params, QNB_USER, QNB_PASS, opts),
      signal: AbortSignal.timeout(60_000),
    });
    xml = await res.text();
  } catch (e) {
    throw new QnbError(`QNB'ye ulaşılamadı: ${e instanceof Error ? e.message : String(e)}`);
  }
  const fault = parseFault(xml);
  if (!fault) return xml;
  if (isLoginFault(fault)) {
    // Bloke hesapta doğru şifre de reddedilir; her deneme blokeyi uzatabilir
    const bloke = /bloke|locked|kilit/i.test(fault);
    loginBlockedUntil.set(url, Date.now() + (bloke ? BLOKE_COOLDOWN_MS : LOGIN_COOLDOWN_MS));
    throw new LoginError(
      bloke
        ? `QNB hesabı bloke oldu (${fault}). QNB eSolutions portalından ya da destekten açtırın; açılana kadar tekrar denemeyin.`
        : `QNB girişi başarısız: ${fault}`,
    );
  }
  throw new QnbError(`QNB hatası: ${fault}`);
}

const compact = (s: string) => s.replace(/-/g, '');

/** e-Arşiv listesinin bir sayfası; QNB iş hatasında mesajı döner */
async function earsivPage(baslangic: string, bitis: string, start: number): Promise<EFatura[] | string> {
  const xml = await soap(EARSIV_URL, 'faturaListeSorgula', { input: JSON.stringify(earsivListInput(QNB_VKN, baslangic, bitis, start)) }, { earsiv: true });
  const r = parseEarsivResult(xml);
  if (r.code && r.code !== EARSIV_OK) return `${r.code}: ${(r.text || 'açıklama yok').slice(0, 700)}`;
  return parseEarsivList(xml, baslangic, bitis);
}

/**
 * Giden e-Arşiv faturaları, 100'lük sayfalarla. pagingStart'ın kayıt sırası mı sayfa numarası mı olduğu
 * belgesiz: ilk sayfa doluysa start=1 ile bakılır; sonuç ilk sayfayla büyük ölçüde örtüşüyorsa kayıt
 * sırasıdır. Giriş hatasında gelen ve giden e-Fatura listesi yine gösterilir.
 */
async function earsivList(baslangic: string, bitis: string): Promise<{ list: EFatura[]; hata?: string }> {
  try {
    const first = await earsivPage(baslangic, bitis, 0);
    if (typeof first === 'string') return { list: [], hata: first };
    const pages = [first];
    if (first.length >= EARSIV_PAGE) {
      const probe = await earsivPage(baslangic, bitis, 1);
      if (typeof probe === 'string') return { list: first, hata: probe };
      const ids = new Set(first.map((f) => f.ettn));
      const offset = probe.filter((f) => ids.has(f.ettn)).length > EARSIV_PAGE / 2;
      let page = offset ? first : probe;
      if (!offset) pages.push(probe);
      // En fazla 20 sayfa (2000 fatura/ay)
      for (let n = offset ? 1 : 2; page.length >= EARSIV_PAGE && n < 20; n++) {
        const next = await earsivPage(baslangic, bitis, offset ? n * EARSIV_PAGE : n);
        if (typeof next === 'string') return { list: mergeLists(...pages), hata: next };
        pages.push(next);
        page = next;
      }
    }
    return { list: mergeLists(...pages) };
  } catch (e) {
    return { list: [], hata: e instanceof Error ? e.message : String(e) };
  }
}

async function listele(yon: Yon, baslangic: string, bitis: string) {
  const { op, params } = listRequest(yon, QNB_VKN, compact(baslangic), compact(bitis));
  const efatura = parseList(await soap(QNB_URL, op, params), yon);
  if (yon === 'gelen') return { faturalar: efatura };
  const earsiv = await earsivList(baslangic, bitis);
  return {
    faturalar: mergeLists(efatura, earsiv.list),
    ...(earsiv.hata ? { uyari: `e-Arşiv faturaları alınamadı: ${earsiv.hata}` } : {}),
  };
}

type Tur = 'efatura' | 'earsiv';

/** Tek faturanın kendisi (UBL ya da PDF), ham bayt olarak */
async function belge(tur: Tur, yon: Yon, ettn: string, format: 'UBL' | 'PDF'): Promise<Uint8Array> {
  const unzipped = (b64: string) => extractFile(base64ToBytes(b64), unzipSync, format === 'PDF' ? 'pdf' : 'xml');
  if (tur === 'efatura') {
    const { op, params } = detailRequest(yon, QNB_VKN, ettn, format);
    const b64 = parseBase64Return(await soap(QNB_URL, op, params, { wrap: false }));
    if (!b64) throw new QnbError('QNB faturanın içeriğini döndürmedi.');
    return unzipped(b64);
  }
  // e-Arşiv: faturaSorgula girdisi belgesiz; olası biçimler sırayla denenir
  const hatalar: string[] = [];
  for (const input of earsivDocInputs(QNB_VKN, ettn, EARSIV_FORMAT[format])) {
    let xml: string;
    try {
      xml = await soap(EARSIV_URL, 'faturaSorgula', { input: JSON.stringify(input) }, { earsiv: true });
    } catch (e) {
      if (e instanceof LoginError) throw e;
      hatalar.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    const r = parseEarsivResult(xml);
    const b64 = parseEarsivDoc(xml);
    if (b64 && (r.code === EARSIV_OK || !r.code)) {
      console.log(`e-Arşiv faturaSorgula: ${Object.keys(input).join(',')} biçimi çalıştı`);
      return unzipped(b64);
    }
    hatalar.push(`${r.code || 'kod yok'}: ${(r.text || 'belge dönmedi').slice(0, 700)} [${Object.keys(input).join(',')}]`);
  }
  throw new QnbError(`e-Arşiv faturası alınamadı: ${hatalar.join(' | ')}`);
}

async function detay(tur: Tur, yon: Yon, ettn: string) {
  return { detay: parseUbl(new TextDecoder('utf-8').decode(await belge(tur, yon, ettn, 'UBL'))) };
}

async function pdf(tur: Tur, yon: Yon, ettn: string) {
  const bytes = await belge(tur, yon, ettn, 'PDF');
  // %PDF imzası
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    throw new QnbError('QNB PDF yerine başka bir içerik döndürdü.');
  }
  return { pdf: bytesToBase64(bytes) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { message: 'Yalnızca POST' });

  const email = await userEmail(req);
  if (email === null) return reply(401, { message: 'Giriş yapmanız gerekiyor.' });
  if (!ALLOWED.includes(email)) {
    // Kendi e-postasını görmesi, secret'a neyin yazılacağını gösterir (başkasının bilgisi değil)
    const hint = ALLOWED.length
      ? `QNB_ALLOWED_EMAILS içinde ${ALLOWED.length} adres var ama bu hesap yok.`
      : 'QNB_ALLOWED_EMAILS Supabase’de boş.';
    return reply(403, { message: `Bu hesabın (${email || 'e-postasız hesap'}) e-faturaları görme yetkisi yok. ${hint}` });
  }
  if (!QNB_USER || !QNB_PASS || !/^\d{10,11}$/.test(QNB_VKN)) {
    return reply(500, { message: 'Sunucuda QNB bilgileri (QNB_USER, QNB_PASS, QNB_VKN) eksik.' });
  }

  let b: { islem?: unknown; yon?: unknown; baslangic?: unknown; bitis?: unknown; ettn?: unknown; tur?: unknown };
  try {
    b = await req.json();
  } catch {
    return reply(400, { message: 'Geçersiz istek gövdesi.' });
  }
  if (b.yon !== 'gelen' && b.yon !== 'giden') return reply(400, { message: "yon 'gelen' ya da 'giden' olmalı." });
  const yon = b.yon as Yon;

  try {
    if (b.islem === 'detay' || b.islem === 'pdf') {
      if (typeof b.ettn !== 'string' || !ETTN_RE.test(b.ettn)) return reply(400, { message: 'Geçersiz ETTN.' });
      const tur: Tur = b.tur === 'earsiv' ? 'earsiv' : 'efatura';
      return reply(200, b.islem === 'pdf' ? await pdf(tur, yon, b.ettn) : await detay(tur, yon, b.ettn));
    }
    if (!validRange(b.baslangic, b.bitis)) return reply(400, { message: `Tarih aralığı geçersiz (en fazla ${MAX_DAYS} gün).` });
    return reply(200, await listele(yon, b.baslangic, b.bitis as string));
  } catch (e) {
    if (e instanceof LoginError) return reply(502, { code: 'qnb_login', message: e.message });
    const message = e instanceof Error ? e.message : String(e);
    return reply(/ulaşılamadı/.test(message) ? 504 : 502, { message });
  }
});
