// Supabase Edge Function: eski fişlerin kalemlerini arşivdeki fotoğraftan okur (geriye dönük doldurma).
//
// İki çağrı biçimi:
// 1) Zamanlayıcı (pg_cron, 009 kurulumu): `x-kalem-cron` başlığıyla, Gemini günlük kotası sıfırlanmadan önceki
//    saatte (Pasifik 23:00–23:55; Türkiye'de yazın 09:00, kışın 10:00'dan itibaren) yalnızca Flash modelleriyle,
//    o gün kullanılmayan kotayla çalışır. Pencere dışında hiçbir şey yapmaz.
// 2) Deneme: giriş yapmış kullanıcı `{ "deneme": true, "adet": 20, "model": "..." }` ile kendi fişlerinden
//    en fazla 20'sini hemen okutur (Flash / Flash Lite kalitesini karşılaştırmak için).
//
// Fişin tutar, KDV ve diğer alanlarına dokunulmaz; yalnızca receipt_items yazılır ve kalem_durumu işaretlenir.
// Yayın: "Supabase fonksiyonunu yayınla" iş akışı (--no-verify-jwt; kimlik doğrulaması burada yapılır).

import { KALEM_KURALLARI, KALEM_SEMASI, kalemleriAyikla, kalemlerTutarli, kalemSatirlari, kalemToplami } from '../_shared/kalemler.ts';

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET = 'receipt-images';

/** Zamanlayıcının kullandığı modeller: güçlü olanlar (günlük 20'şer) */
const FLASH = ['gemini-2.5-flash', 'gemini-3.6-flash'];
const LITE = 'gemini-3.5-flash-lite';
const IZINLI = new Set([...FLASH, LITE]);
/** Dakikalık istek sınırına (Flash 5, Lite 15) göre aynı modele iki istek arası */
const ARALIK_MS: Record<string, number> = { 'gemini-2.5-flash': 12_500, 'gemini-3.6-flash': 12_500, [LITE]: 4_100 };
/**
 * Bir çağrının süresi: fonksiyonun (ve zamanlayıcının) sınırı 150 sn. Yeni bir fiş ancak bu bütçeden bir
 * isteğin en uzun süresi (Gemini sınırı + fotoğraf/veritabanı payı) kadar önce başlatılır.
 */
const BUTCE_MS = 130_000;
/** Gemini isteğinin süre sınırı; aşılırsa fiş sıraya döner (ilk gece bir istek 150 sn sınırını aşmıştı) */
const GEMINI_SURE_MS = 40_000;
/** Bir fişin toplam süresi için ayrılan pay */
const ISTEK_PAYI_MS = GEMINI_SURE_MS + 10_000;
const MAX_DENEME = 3;
const MAX_DENEME_ADET = 20;
/** Yarıda kalan (fonksiyon süresi dolan) "isleniyor" kayıtları bu süreden sonra yeniden alınır */
const KILIT_MS = 10 * 60_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rest(path: string, init: RequestInit & { prefer?: string } = {}) {
  const headers: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (init.prefer) headers.Prefer = init.prefer;
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
}

/** Pasifik saatiyle saat ve dakika (yaz saati dahil) */
function pasifik(now = new Date()): { saat: number; dakika: number } {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const al = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { saat: al('hour'), dakika: al('minute') };
}

/** Kota sıfırlanmadan önceki pencere: Pasifik 23:00–23:54 */
function penceredeMi(now = new Date()): boolean {
  const { saat, dakika } = pasifik(now);
  return saat === 23 && dakika < 55;
}

async function cronDogrula(gizli: string): Promise<boolean> {
  const res = await rest('/rest/v1/rpc/kalem_cron_dogrula', { method: 'POST', body: JSON.stringify({ p_gizli: gizli }) });
  return res.ok && (await res.json().catch(() => false)) === true;
}

/** İstekteki oturumun kullanıcı kimliği (geçersizse null) */
async function kullanici(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? SERVICE_KEY;
  if (!/^Bearer\s+ey/i.test(auth)) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { authorization: auth, apikey } });
    if (!res.ok) return null;
    const u = await res.json().catch(() => null);
    return typeof u?.id === 'string' && u.role === 'authenticated' ? u.id : null;
  } catch {
    return null;
  }
}

interface Aday {
  id: string;
  user_id: string;
  image_path: string;
  firma_adi: string;
  toplam_tutar: number;
  kalem_deneme: number;
}

/** Okunmayı bekleyen (ya da yarıda kalmış) fotoğraflı fişler, yeniden eskiye */
function bekleyenFiltresi(): string {
  const eski = new Date(Date.now() - KILIT_MS).toISOString();
  return `(kalem_durumu.is.null,and(kalem_durumu.eq.isleniyor,kalem_denendi_at.lt."${eski}"))`;
}

async function adaylar(limit: number, userId: string | null): Promise<Aday[]> {
  const q = new URLSearchParams({
    select: 'id,user_id,image_path,firma_adi,toplam_tutar,kalem_deneme',
    image_path: 'not.is.null',
    or: bekleyenFiltresi(),
    order: 'tarih.desc',
    limit: String(limit),
  });
  if (userId) q.set('user_id', `eq.${userId}`);
  const res = await rest(`/rest/v1/receipts?${q}`);
  if (!res.ok) throw new Error(`Fişler alınamadı: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as Aday[]).map((a) => ({ ...a, toplam_tutar: Number(a.toplam_tutar), kalem_deneme: Number(a.kalem_deneme ?? 0) }));
}

async function kalanSayisi(userId: string | null): Promise<number | null> {
  const q = new URLSearchParams({ select: 'id', image_path: 'not.is.null', or: bekleyenFiltresi(), limit: '1' });
  if (userId) q.set('user_id', `eq.${userId}`);
  const res = await rest(`/rest/v1/receipts?${q}`, { prefer: 'count=exact' });
  const n = Number(res.headers.get('content-range')?.split('/')[1]);
  return Number.isFinite(n) ? n : null;
}

/** Fişi bu çalışma için kilitler; başka bir çalışma almışsa false */
async function kilitle(a: Aday): Promise<boolean> {
  const q = new URLSearchParams({ id: `eq.${a.id}`, or: bekleyenFiltresi() });
  const res = await rest(`/rest/v1/receipts?${q}`, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: JSON.stringify({ kalem_durumu: 'isleniyor', kalem_denendi_at: new Date().toISOString() }),
  });
  return res.ok && ((await res.json().catch(() => [])) as unknown[]).length === 1;
}

async function durumYaz(id: string, degerler: Record<string, unknown>): Promise<void> {
  await rest(`/rest/v1/receipts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(degerler) });
}

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function fotograf(path: string): Promise<string> {
  const yol = path.split('/').map(encodeURIComponent).join('/');
  const res = await rest(`/storage/v1/object/${BUCKET}/${yol}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Fotoğraf indirilemedi: ${res.status}`);
  return base64(new Uint8Array(await res.arrayBuffer()));
}

const SISTEM = `- Sen Türkiye'deki POS fişlerini ve faturaları okuyan bir muhasebe asistanısın. Yalnızca fişteki ürün/hizmet satırlarını çıkar.
- Çıktıyı SADECE geçerli JSON olarak ver: {"kalemler": [...]}.
- Sayılarda ondalık ayırıcı olarak nokta kullan (ör. 1234.56), binlik ayırıcı kullanma.
${KALEM_KURALLARI}
- Fotoğraf küçük ya da düşük çözünürlüklü olabilir: net okuyamadığın satırı atla, tahmin etme.`;

const SEMA = { type: 'object', properties: { kalemler: KALEM_SEMASI }, required: ['kalemler'], additionalProperties: false };

type GeminiSonuc = { text: string } | { status: number; message: string };

async function oku(model: string, image: string): Promise<GeminiSonuc> {
  try {
    return await okuIstek(model, image);
  } catch (e) {
    // Süre aşımı ya da bağlantı hatası: geçici sayılır (fiş sıraya döner, deneme hakkı yanmaz)
    return { status: 504, message: e instanceof Error ? e.message : String(e) };
  }
}

async function okuIstek(model: string, image: string): Promise<GeminiSonuc> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    signal: AbortSignal.timeout(GEMINI_SURE_MS),
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SISTEM }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: image } }, { text: 'Bu fişin kalemlerini çıkar.' }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SEMA, temperature: 0 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { status: res.status, message: json?.error?.message ?? `HTTP ${res.status}` };
  const text = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  return text ? { text } : { status: 502, message: 'Gemini boş yanıt döndürdü.' };
}

interface FisSonucu {
  id: string;
  firma: string;
  toplam: number;
  kalemAdedi: number;
  kalemToplami: number;
  tutarli: boolean;
  model: string;
}

interface Ozet {
  calisti: boolean;
  neden?: string;
  okundu: number;
  tutarli: number;
  bos: number;
  okunamadi: number;
  /** Kotası dolan ya da yoğun olduğu için bırakılan modeller */
  dolanModeller: string[];
  kalan: number | null;
  sonuclar: FisSonucu[];
}

async function calistir(opts: { modeller: string[]; adet: number; userId: string | null; pencereli: boolean }): Promise<Ozet> {
  const basla = Date.now();
  const ozet: Ozet = { calisti: true, okundu: 0, tutarli: 0, bos: 0, okunamadi: 0, dolanModeller: [], kalan: null, sonuclar: [] };
  const aktif = [...opts.modeller];
  const sonIstek = new Map<string, number>();
  const liste = await adaylar(opts.adet, opts.userId);

  for (const a of liste) {
    if (!aktif.length) break;
    // En erken istek atılabilecek model
    const simdi = Date.now();
    const model = aktif.reduce((m, x) => ((sonIstek.get(x) ?? 0) + ARALIK_MS[x]! < (sonIstek.get(m) ?? 0) + ARALIK_MS[m]! ? x : m));
    const bekleme = Math.max(0, (sonIstek.get(model) ?? 0) + ARALIK_MS[model]! - simdi);
    if (Date.now() - basla + bekleme + ISTEK_PAYI_MS > BUTCE_MS) break;
    if (opts.pencereli && !penceredeMi(new Date(Date.now() + bekleme))) {
      ozet.neden = 'Kota penceresi bitti';
      break;
    }
    if (a.kalem_deneme >= MAX_DENEME) {
      await durumYaz(a.id, { kalem_durumu: 'okunamadi' });
      ozet.okunamadi += 1;
      continue;
    }
    if (!(await kilitle(a))) continue;

    let image: string;
    try {
      image = await fotograf(a.image_path);
    } catch {
      const deneme = a.kalem_deneme + 1;
      await durumYaz(a.id, { kalem_durumu: deneme >= MAX_DENEME ? 'okunamadi' : null, kalem_deneme: deneme });
      if (deneme >= MAX_DENEME) ozet.okunamadi += 1;
      continue;
    }

    if (bekleme) await bekle(bekleme);
    sonIstek.set(model, Date.now());
    const r = await oku(model, image);

    if (!('text' in r)) {
      // Kota/yoğunluk: fiş sıraya döner (deneme hakkı yanmaz), model bu çalışmada bırakılır
      if (r.status === 429 || r.status >= 500) {
        await durumYaz(a.id, { kalem_durumu: null });
        aktif.splice(aktif.indexOf(model), 1);
        ozet.dolanModeller.push(model);
        continue;
      }
      if (r.status === 401 || r.status === 403) {
        await durumYaz(a.id, { kalem_durumu: null });
        throw new Error(`Gemini anahtarı reddedildi: ${r.message}`);
      }
      const deneme = a.kalem_deneme + 1;
      await durumYaz(a.id, { kalem_durumu: deneme >= MAX_DENEME ? 'okunamadi' : null, kalem_deneme: deneme });
      if (deneme >= MAX_DENEME) ozet.okunamadi += 1;
      continue;
    }

    let kalemler;
    try {
      const obj = JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1));
      kalemler = kalemleriAyikla(obj?.kalemler);
    } catch {
      const deneme = a.kalem_deneme + 1;
      await durumYaz(a.id, { kalem_durumu: deneme >= MAX_DENEME ? 'okunamadi' : null, kalem_deneme: deneme });
      if (deneme >= MAX_DENEME) ozet.okunamadi += 1;
      continue;
    }

    if (kalemler.length) {
      // Önceki yarım kalmış yazımlar temizlenir, sonra hepsi tek istekte yazılır
      await rest(`/rest/v1/receipt_items?receipt_id=eq.${a.id}`, { method: 'DELETE' });
      const ins = await rest('/rest/v1/receipt_items', {
        method: 'POST',
        body: JSON.stringify(kalemSatirlari(a.id, kalemler, 'geriye_donuk', a.user_id)),
      });
      if (!ins.ok) {
        await durumYaz(a.id, { kalem_durumu: null });
        throw new Error(`Kalemler yazılamadı: ${ins.status} ${(await ins.text()).slice(0, 200)}`);
      }
    }
    await durumYaz(a.id, { kalem_durumu: kalemler.length ? 'okundu' : 'yok', kalem_model: model, kalem_deneme: a.kalem_deneme + 1 });
    const tutarli = kalemlerTutarli(kalemler, a.toplam_tutar);
    if (kalemler.length) ozet.okundu += 1;
    else ozet.bos += 1;
    if (tutarli) ozet.tutarli += 1;
    ozet.sonuclar.push({
      id: a.id,
      firma: a.firma_adi,
      toplam: a.toplam_tutar,
      kalemAdedi: kalemler.length,
      kalemToplami: kalemToplami(kalemler),
      tutarli,
      model,
    });
  }
  ozet.kalan = await kalanSayisi(opts.userId);
  return ozet;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { message: 'Yalnızca POST' });
  if (!SUPABASE_URL || !SERVICE_KEY) return reply(500, { message: 'Sunucuda SUPABASE_SERVICE_ROLE_KEY yok.' });

  const cron = req.headers.get('x-kalem-cron');
  let mod: { modeller: string[]; adet: number; userId: string | null; pencereli: boolean };
  if (cron) {
    if (!(await cronDogrula(cron))) return reply(401, { message: 'Geçersiz zamanlayıcı anahtarı.' });
    if (!penceredeMi()) return reply(200, { calisti: false, neden: 'Kota penceresi dışında' });
    // Bir çağrı ~110 sn sürer; zamanlayıcı 5 dakikada bir çağırır
    mod = { modeller: FLASH, adet: 40, userId: null, pencereli: true };
  } else {
    const userId = await kullanici(req);
    if (!userId) return reply(401, { message: 'Giriş yapmanız gerekiyor.' });
    const b = (await req.json().catch(() => ({}))) as { deneme?: unknown; adet?: unknown; model?: unknown };
    if (b.deneme !== true) return reply(400, { message: 'Elle yalnızca deneme çalıştırılabilir ({"deneme": true}).' });
    const model = typeof b.model === 'string' && IZINLI.has(b.model) ? b.model : FLASH[0]!;
    const adet = Math.min(MAX_DENEME_ADET, Math.max(1, Math.floor(Number(b.adet) || MAX_DENEME_ADET)));
    mod = { modeller: [model], adet, userId, pencereli: false };
  }
  if (!GEMINI_KEY) return reply(500, { message: 'Sunucuda GEMINI_API_KEY tanımlı değil.' });

  try {
    return reply(200, await calistir(mod));
  } catch (e) {
    return reply(500, { message: e instanceof Error ? e.message : String(e) });
  }
});
