// Supabase Edge Function: QNB eSolutions'tan gelen/giden e-faturaları listeler (yalnızca okuma).
// QNB kullanıcı kodu, şifresi ve VKN sunucuda (Supabase secret) durur, uygulamaya girmez.
//
// Gerekli secret'lar: QNB_USER, QNB_PASS, QNB_VKN, QNB_ALLOWED_EMAILS (virgülle ayrılmış).
// QNB_ALLOWED_EMAILS boşsa kimse çağıramaz: faturalar tek bir firmaya ait, her giriş yapan görmesin.
//
// İstek: POST { yon: 'gelen' | 'giden', baslangic: 'YYYY-MM-DD', bitis: 'YYYY-MM-DD' }
// Yanıt: { faturalar: EFatura[] }  ya da hata: { message, code? }  (code: 'qnb_login' → tekrar denemeyin)

import { buildEnvelope, isLoginFault, listRequest, parseFault, parseList, QNB_URL, type Yon } from './soap.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const QNB_USER = Deno.env.get('QNB_USER') ?? '';
const QNB_PASS = Deno.env.get('QNB_PASS') ?? '';
const QNB_VKN = Deno.env.get('QNB_VKN') ?? '';
const ALLOWED = (Deno.env.get('QNB_ALLOWED_EMAILS') ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** En uzun sorgu aralığı (uygulama ay ay sorar) */
const MAX_DAYS = 62;
/** QNB giriş hatasından sonra bu süre boyunca QNB'ye hiç istek atılmaz (hesap kilitlenmesin) */
const LOGIN_COOLDOWN_MS = 15 * 60_000;
let loginBlockedUntil = 0;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { message: 'Yalnızca POST' });

  const email = await userEmail(req);
  if (email === null) return reply(401, { message: 'Giriş yapmanız gerekiyor.' });
  if (!ALLOWED.includes(email)) return reply(403, { message: 'Bu hesabın e-faturaları görme yetkisi yok.' });
  if (!QNB_USER || !QNB_PASS || !/^\d{10,11}$/.test(QNB_VKN)) {
    return reply(500, { message: 'Sunucuda QNB bilgileri (QNB_USER, QNB_PASS, QNB_VKN) eksik.' });
  }
  if (Date.now() < loginBlockedUntil) {
    return reply(502, { code: 'qnb_login', message: 'QNB girişi az önce başarısız oldu. Hesap kilitlenmesin diye bir süre yeniden denenmiyor.' });
  }

  let b: { yon?: unknown; baslangic?: unknown; bitis?: unknown };
  try {
    b = await req.json();
  } catch {
    return reply(400, { message: 'Geçersiz istek gövdesi.' });
  }
  if (b.yon !== 'gelen' && b.yon !== 'giden') return reply(400, { message: "yon 'gelen' ya da 'giden' olmalı." });
  if (!validRange(b.baslangic, b.bitis)) return reply(400, { message: `Tarih aralığı geçersiz (en fazla ${MAX_DAYS} gün).` });
  const yon = b.yon as Yon;
  const compact = (s: string) => s.replace(/-/g, '');

  const { op, params } = listRequest(yon, QNB_VKN, compact(b.baslangic), compact(b.bitis as string));
  let xml: string;
  try {
    const res = await fetch(QNB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body: buildEnvelope(op, params, QNB_USER, QNB_PASS),
      signal: AbortSignal.timeout(60_000),
    });
    xml = await res.text();
  } catch (e) {
    return reply(504, { message: `QNB'ye ulaşılamadı: ${e instanceof Error ? e.message : String(e)}` });
  }

  const fault = parseFault(xml);
  if (fault) {
    if (isLoginFault(fault)) {
      loginBlockedUntil = Date.now() + LOGIN_COOLDOWN_MS;
      return reply(502, { code: 'qnb_login', message: `QNB girişi başarısız: ${fault}` });
    }
    return reply(502, { message: `QNB hatası: ${fault}` });
  }
  return reply(200, { faturalar: parseList(xml, yon) });
});
