// Supabase Edge Function: QNB eSolutions üzerinden e-Fatura / e-Arşiv fatura KESER.
// Okuma işleri qnb-efatura'dadır; durum değiştiren her şey bilerek bu ayrı fonksiyondadır.
//
// Güvenlik kilidi (Supabase secret QNB_KESIM):
//   boş / tanımsız → fatura kesilemez; yalnızca önizleme ve mükellef sorgusu çalışır
//   'test'         → QNB test ortamı: QNB_TEST_USER, QNB_TEST_PASS, QNB_TEST_VKN
//                    (adresler değişirse QNB_TEST_EFATURA_URL, QNB_TEST_EARSIV_URL)
//   'canli'        → GERÇEK fatura: QNB_USER, QNB_PASS, QNB_VKN (okuma fonksiyonuyla aynı hesap)
// Yetki: QNB_ALLOWED_EMAILS (qnb-efatura ile aynı liste).
//
// İstekler (POST):
//   { islem: 'durum' }                               → { ortam, saticiVkn }
//   { islem: 'mukellef', vknTckn }                   → { efatura: boolean }
//   { islem: 'onizle', fatura, satici }              → { xml, toplamlar } | 400 { hatalar }
//   { islem: 'kes', fatura, satici, seri, ortam, onay: true }
//       → { sonuc: { tur, ettn, belgeNo, belgeOid?, durum, ortam } }
//     ortam, istemcinin kullanıcıya gösterdiği ortamdır; sunucununkiyle aynı değilse reddedilir.
// Hata: { message, code? }

import {
  CANLI_EARSIV_URL,
  CANLI_EFATURA_URL,
  EARSIV_OK,
  SERI_RE,
  TEST_EARSIV_URL,
  TEST_EFATURA_URL,
  belgeGonderIstegi,
  donusAlanlari,
  donusMetni,
  durumIstegi,
  earsivOlusturIstegi,
  earsivSonucu,
  faturaNo,
  faturaNoIstegi,
  girisHatasiMi,
  hataMesaji,
  mukellefIstegi,
  mukellefMi,
  zarf,
} from './istek.ts';
import { dogrula, hesapla, ublOlustur, type FaturaGirdi, type Taraf } from './ubl.ts';

const env = (k: string) => (Deno.env.get(k) ?? '').trim();
const SUPABASE_URL = env('SUPABASE_URL');
const ALLOWED = env('QNB_ALLOWED_EMAILS')
  .split(/[\s,;]+/)
  .map((s) => s.replace(/["'<>]/g, '').trim().toLowerCase())
  .filter(Boolean);

type Ortam = 'kapali' | 'test' | 'canli';
const KESIM = env('QNB_KESIM').toLowerCase();
const ORTAM: Ortam = KESIM === 'canli' ? 'canli' : KESIM === 'test' ? 'test' : 'kapali';

interface Hesap { user: string; pass: string; vkn: string; efaturaUrl: string; earsivUrl: string }
const CANLI: Hesap = { user: env('QNB_USER'), pass: env('QNB_PASS'), vkn: env('QNB_VKN'), efaturaUrl: CANLI_EFATURA_URL, earsivUrl: CANLI_EARSIV_URL };
const TEST: Hesap = {
  user: env('QNB_TEST_USER'),
  pass: env('QNB_TEST_PASS'),
  vkn: env('QNB_TEST_VKN'),
  efaturaUrl: env('QNB_TEST_EFATURA_URL') || TEST_EFATURA_URL,
  earsivUrl: env('QNB_TEST_EARSIV_URL') || TEST_EARSIV_URL,
};
/** Kesimde kullanılan hesap; kilit kapalıyken okuma için gerçek hesap (mükellef sorgusu) */
const HESAP = ORTAM === 'test' ? TEST : CANLI;
const hesapTamam = (h: Hesap) => !!h.user && !!h.pass && /^\d{10,11}$/.test(h.vkn);

/** Giriş hatasından sonra QNB'ye bir süre istek atılmaz (hesap kilitlenmesin) */
const girisEngeli = new Map<string, number>();
/** Bu sunucu örneğinde gönderilmiş ETTN'ler: aynı fatura art arda iki kez gönderilmesin */
const gonderilen = new Map<string, unknown>();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class QnbHatasi extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

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

/** Tek SOAP çağrısı. Durum değiştiren metotlar ASLA otomatik tekrar denenmez (çift fatura riski). */
async function soap(h: Hesap, url: string, op: string, govde: string, earsiv = false): Promise<string> {
  if (Date.now() < (girisEngeli.get(url) ?? 0)) {
    throw new QnbHatasi('QNB girişi az önce başarısız oldu; hesap kilitlenmesin diye bir süre denenmiyor.', 'qnb_login');
  }
  let xml: string;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '""' },
      body: zarf(op, govde, h.user, h.pass, earsiv),
      signal: AbortSignal.timeout(90_000),
    });
    xml = await res.text();
  } catch (e) {
    throw new QnbHatasi(`QNB'ye ulaşılamadı (${op}): ${e instanceof Error ? e.message : String(e)}`, 'ulasilamadi');
  }
  const fault = hataMesaji(xml);
  if (fault) {
    if (girisHatasiMi(fault)) {
      girisEngeli.set(url, Date.now() + 15 * 60_000);
      throw new QnbHatasi(`QNB girişi başarısız: ${fault}`, 'qnb_login');
    }
    throw new QnbHatasi(`QNB hatası (${op}): ${fault}`);
  }
  return xml;
}

async function mukellef(h: Hesap, vknTckn: string): Promise<boolean> {
  const { op, govde } = mukellefIstegi(vknTckn);
  const v = mukellefMi(await soap(h, h.efaturaUrl, op, govde));
  if (v === null) throw new QnbHatasi('QNB, alıcının e-Fatura mükellefi olup olmadığını bildirmedi.');
  return v;
}

/** İstemciden gelen satıcı bilgisi; VKN her zaman sunucudaki hesabın VKN'sidir (başkası adına kesilemez). */
function saticiAl(x: unknown, vkn: string): Taraf {
  const s = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof s[k] === 'string' ? (s[k] as string).slice(0, 300) : undefined);
  return {
    vknTckn: vkn,
    unvan: str('unvan'),
    ad: str('ad'),
    soyad: str('soyad'),
    vergiDairesi: str('vergiDairesi'),
    adres: str('adres'),
    ilce: str('ilce') ?? '',
    il: str('il') ?? '',
    ulke: str('ulke'),
    eposta: str('eposta'),
    telefon: str('telefon'),
  };
}

function faturaAl(x: unknown): FaturaGirdi | null {
  if (!x || typeof x !== 'object') return null;
  const f = x as FaturaGirdi;
  if (!f.alici || typeof f.alici !== 'object' || !Array.isArray(f.kalemler)) return null;
  const a = f.alici as Taraf;
  return {
    tur: f.tur,
    senaryo: f.senaryo === 'TICARIFATURA' ? 'TICARIFATURA' : 'TEMELFATURA',
    ettn: String(f.ettn ?? '').toLowerCase(),
    tarih: String(f.tarih ?? ''),
    saat: String(f.saat ?? ''),
    not: typeof f.not === 'string' ? f.not : undefined,
    alici: { ...a, vknTckn: String(a.vknTckn ?? '').trim() },
    kalemler: f.kalemler.map((k) => ({
      ad: String(k?.ad ?? ''),
      miktar: Number(k?.miktar),
      birim: String(k?.birim ?? ''),
      birimFiyat: Number(k?.birimFiyat),
      kdvOrani: Number(k?.kdvOrani),
      iskontoOrani: k?.iskontoOrani == null ? undefined : Number(k.iskontoOrani),
    })),
  };
}

/** Fatura tarihi bugünden ileri olamaz, en çok 7 gün geriye gidebilir (GİB kuralı) */
function tarihHatasi(tarih: string): string | null {
  const bugun = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10); // Türkiye saati
  if (tarih > bugun) return 'Fatura tarihi ileri bir gün olamaz.';
  const fark = (Date.parse(bugun) - Date.parse(tarih)) / 86_400_000;
  if (fark > 7) return 'Fatura tarihi en çok 7 gün öncesi olabilir.';
  return null;
}

async function kes(h: Hesap, g: FaturaGirdi, satici: Taraf, seri: string) {
  // Alıcı e-Fatura mükellefiyse e-Arşiv, değilse e-Fatura kesilemez
  if (g.alici.vknTckn !== '11111111111') {
    const kayitli = await mukellef(h, g.alici.vknTckn);
    if (kayitli && g.tur === 'earsiv') throw new QnbHatasi('Alıcı e-Fatura mükellefi: e-Arşiv değil, e-Fatura kesilmeli.', 'tur');
    if (!kayitli && g.tur === 'efatura') throw new QnbHatasi('Alıcı e-Fatura mükellefi değil: e-Arşiv fatura kesilmeli.', 'tur');
  } else if (g.tur === 'efatura') {
    throw new QnbHatasi('Kimliği bilinmeyen alıcıya e-Fatura kesilemez.', 'tur');
  }

  if (g.tur === 'earsiv') {
    const xml = ublOlustur(g, satici);
    const { op, govde } = earsivOlusturIstegi(h.vkn, g.ettn, xml, seri);
    const s = earsivSonucu(await soap(h, h.earsivUrl, op, govde, true));
    if (s.kod !== EARSIV_OK) throw new QnbHatasi(`e-Arşiv faturası oluşturulamadı: ${s.metin || s.kod || 'QNB yanıtı anlaşılamadı'}`);
    return { tur: g.tur, ettn: g.ettn, belgeNo: s.ek.faturaNo ?? '', durum: 'Oluşturuldu', faturaUrl: s.ek.faturaURL };
  }

  // e-Fatura: önce numara alınır, numara faturaya yazılıp gönderilir
  const no = faturaNoIstegi(h.vkn, seri);
  const xmlNo = await soap(h, h.efaturaUrl, no.op, no.govde);
  const belgeNo = faturaNo(xmlNo);
  if (!belgeNo) throw new QnbHatasi(`QNB fatura numarası vermedi (yanıt: ${(donusMetni(xmlNo) ?? '').slice(0, 100)}).`);
  const xml = ublOlustur(g, satici, belgeNo);
  const gon = belgeGonderIstegi(h.vkn, g.ettn, xml);
  const belgeOid = donusMetni(await soap(h, h.efaturaUrl, gon.op, gon.govde)) ?? '';
  let durum = 'QNB kuyruğuna alındı';
  if (belgeOid) {
    try {
      const d = durumIstegi(h.vkn, belgeOid);
      const r = donusAlanlari(await soap(h, h.efaturaUrl, d.op, d.govde));
      durum = r.durumAciklama || r.gonderimDurumuAciklama || r.aciklama || durum;
    } catch {
      // Durum sorgusu başarısızsa gönderim yine yapılmıştır
    }
  }
  return { tur: g.tur, ettn: g.ettn, belgeNo, belgeOid, durum };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { message: 'Yalnızca POST' });

  const email = await userEmail(req);
  if (email === null) return reply(401, { message: 'Giriş yapmanız gerekiyor.' });
  if (!ALLOWED.includes(email)) return reply(403, { message: `Bu hesabın (${email || 'e-postasız hesap'}) fatura kesme yetkisi yok.` });

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return reply(400, { message: 'Geçersiz istek gövdesi.' });
  }

  try {
    if (b.islem === 'durum') return reply(200, { ortam: ORTAM, saticiVkn: hesapTamam(HESAP) ? HESAP.vkn : null });

    if (b.islem === 'mukellef') {
      const v = String(b.vknTckn ?? '').trim();
      if (!/^\d{10,11}$/.test(v)) return reply(400, { message: 'VKN 10, TCKN 11 haneli olmalı.' });
      if (!hesapTamam(HESAP)) return reply(500, { message: 'Sunucuda QNB bilgileri eksik.' });
      return reply(200, { efatura: await mukellef(HESAP, v) });
    }

    if (b.islem === 'onizle' || b.islem === 'kes') {
      const vkn = hesapTamam(HESAP) ? HESAP.vkn : /^\d{10,11}$/.test(CANLI.vkn) ? CANLI.vkn : '';
      if (!vkn) return reply(500, { message: 'Sunucuda firma VKN bilgisi (QNB_VKN) eksik.' });
      const g = faturaAl(b.fatura);
      if (!g) return reply(400, { message: 'Fatura bilgileri eksik.' });
      const satici = saticiAl(b.satici, vkn);
      const hatalar = dogrula(g, satici);
      const th = tarihHatasi(g.tarih);
      if (th) hatalar.push(th);
      if (hatalar.length) return reply(400, { message: hatalar[0], hatalar });

      if (b.islem === 'onizle') {
        return reply(200, { xml: ublOlustur(g, satici, g.tur === 'efatura' ? 'XXX0000000000000' : ''), toplamlar: hesapla(g.kalemler) });
      }

      if (ORTAM === 'kapali') {
        return reply(403, { code: 'kapali', message: 'Fatura kesme sunucuda kapalı (QNB_KESIM tanımlı değil). Önce test ortamı açılmalı.' });
      }
      if (b.ortam !== ORTAM) return reply(409, { code: 'ortam', message: 'Ortam değişmiş; sayfayı yenileyip tekrar deneyin.' });
      if (b.onay !== true) return reply(400, { message: 'Gönderim onayı eksik.' });
      if (!hesapTamam(HESAP)) {
        return reply(500, { message: ORTAM === 'test' ? 'Test hesabı bilgileri (QNB_TEST_USER, QNB_TEST_PASS, QNB_TEST_VKN) eksik.' : 'Sunucuda QNB bilgileri eksik.' });
      }
      const seri = String(b.seri ?? '').trim().toUpperCase();
      if (g.tur === 'efatura' && !SERI_RE.test(seri)) return reply(400, { message: 'e-Fatura serisi 3 karakter olmalı (ör. ABC).' });
      if (seri && !SERI_RE.test(seri)) return reply(400, { message: 'Seri 3 karakter olmalı (ör. ABC).' });

      if (gonderilen.has(g.ettn)) return reply(200, { sonuc: gonderilen.get(g.ettn), tekrar: true });
      const sonuc = { ...(await kes(HESAP, g, satici, seri)), ortam: ORTAM };
      gonderilen.set(g.ettn, sonuc);
      console.log(`Fatura kesildi (${ORTAM}, ${g.tur}): ${sonuc.belgeNo || '-'} ${g.ettn}`);
      return reply(200, { sonuc });
    }

    return reply(400, { message: 'Bilinmeyen işlem.' });
  } catch (e) {
    if (e instanceof QnbHatasi) {
      return reply(e.code === 'ulasilamadi' ? 504 : e.code === 'tur' ? 409 : 502, { code: e.code, message: e.message });
    }
    return reply(500, { message: e instanceof Error ? e.message : String(e) });
  }
});
