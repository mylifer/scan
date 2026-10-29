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
//   { islem: 'detay', yon, ettn }                         → { detay: FaturaDetay }  (yalnızca e-Fatura)
// Hata: { message, code? }  (code: 'qnb_login' → tekrar denemeyin)

import { unzipSync } from 'npm:fflate@0.8.2';

import {
  base64ToBytes,
  buildEnvelope,
  detailRequest,
  EARSIV_OK,
  EARSIV_URL,
  earsivListInputs,
  ETTN_RE,
  type EFatura,
  extractXml,
  isLoginFault,
  listRequest,
  mergeLists,
  parseBase64Return,
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

/**
 * Giden e-Arşiv faturaları. Girdi alanları belgelenmediği için olası biçimler sırayla denenir;
 * ilk başarılı yanıt kullanılır. Hiçbiri tutmazsa QNB'nin mesajları uyarı olarak döner.
 */
async function earsivList(baslangic: string, bitis: string): Promise<{ list: EFatura[]; hata?: string }> {
  const hatalar: string[] = [];
  for (const input of earsivListInputs(QNB_VKN, baslangic, bitis)) {
    let xml: string;
    try {
      xml = await soap(EARSIV_URL, 'faturaListeSorgula', { input: JSON.stringify(input) }, { earsiv: true });
    } catch (e) {
      // e-Arşiv girişi reddedilirse (ör. ayrı kullanıcı gerekiyorsa) başka biçim denenmez;
      // gelen ve giden e-Fatura listesi yine gösterilir
      if (e instanceof LoginError) return { list: [], hata: e.message };
      hatalar.push(e instanceof Error ? e.message : String(e));
      continue;
    }
    const r = parseEarsivResult(xml);
    if (r.code === EARSIV_OK || (!r.code && /<output\b/.test(xml))) {
      console.log(`e-Arşiv listesi: ${Object.keys(input).join(',')} biçimi çalıştı`);
      return { list: parseEarsivList(xml, baslangic, bitis) };
    }
    hatalar.push(`${r.code || 'kod yok'}: ${r.text || 'açıklama yok'} [${Object.keys(input).join(',')}]`);
  }
  console.log('e-Arşiv listesi alınamadı:', hatalar.join(' | '));
  return { list: [], hata: hatalar.join(' | ') };
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

async function detay(yon: Yon, ettn: string) {
  const { op, params } = detailRequest(yon, QNB_VKN, ettn);
  const b64 = parseBase64Return(await soap(QNB_URL, op, params, { wrap: false }));
  if (!b64) throw new QnbError('QNB faturanın içeriğini döndürmedi.');
  return { detay: parseUbl(extractXml(base64ToBytes(b64), unzipSync)) };
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

  let b: { islem?: unknown; yon?: unknown; baslangic?: unknown; bitis?: unknown; ettn?: unknown };
  try {
    b = await req.json();
  } catch {
    return reply(400, { message: 'Geçersiz istek gövdesi.' });
  }
  if (b.yon !== 'gelen' && b.yon !== 'giden') return reply(400, { message: "yon 'gelen' ya da 'giden' olmalı." });
  const yon = b.yon as Yon;

  try {
    if (b.islem === 'detay') {
      if (typeof b.ettn !== 'string' || !ETTN_RE.test(b.ettn)) return reply(400, { message: 'Geçersiz ETTN.' });
      return reply(200, await detay(yon, b.ettn));
    }
    if (!validRange(b.baslangic, b.bitis)) return reply(400, { message: `Tarih aralığı geçersiz (en fazla ${MAX_DAYS} gün).` });
    return reply(200, await listele(yon, b.baslangic, b.bitis as string));
  } catch (e) {
    if (e instanceof LoginError) return reply(502, { code: 'qnb_login', message: e.message });
    const message = e instanceof Error ? e.message : String(e);
    return reply(/ulaşılamadı/.test(message) ? 504 : 502, { message });
  }
});
