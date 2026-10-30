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
//   { islem: 'ilk-ay' }                                   → { ilkAy: 'YYYY-MM' | null }  (ilk belgenin ayı)
//   { islem: 'ozet-gelen', baslangic, bitis }  (≤62 gün)  → { gelen: TutarSatiri[], qnb }
//   { islem: 'ozet-giden', baslangic, bitis }  (≤6 yıl)   → { giden: TutarSatiri[], earsiv: EFatura[], qnb }
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
  parseEarsivPage,
  parseEarsivResult,
  parseFault,
  parseList,
  parseUbl,
  missingField,
  PORTAL_DEFAULTS,
  isoDate,
  parseReturns,
  parseTutar,
  parseTutarMap,
  parseTutarRows,
  gelenTutarRequest,
  type TutarSatiri,
  portalListRequest,
  tutarRequest,
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

type Sayfa = { list: EFatura[]; ham: number; ornek?: string };

/** e-Arşiv listesinin bir sayfası; QNB iş hatasında mesajı döner */
async function earsivPage(baslangic: string, bitis: string, start: number): Promise<Sayfa | string> {
  const xml = await soap(EARSIV_URL, 'faturaListeSorgula', { input: JSON.stringify(earsivListInput(QNB_VKN, baslangic, bitis, start)) }, { earsiv: true });
  const r = parseEarsivResult(xml);
  if (r.code && r.code !== EARSIV_OK) return `${r.code}: ${(r.text || 'açıklama yok').slice(0, 700)}`;
  return parseEarsivPage(xml, baslangic, bitis);
}

/**
 * Giden e-Arşiv faturaları, 100'lük sayfalarla. pagingStart'ın kayıt sırası mı sayfa numarası mı olduğu
 * belgesiz: ilk sayfa doluysa start=1 ile bakılır; sonuç ilk sayfayla büyük ölçüde örtüşüyorsa kayıt
 * sırasıdır. Giriş hatasında gelen ve giden e-Fatura listesi yine gösterilir.
 * bilgi: QNB'nin kaç kayıt döndürdüğü (liste boşsa nedenini anlamak için).
 */
async function earsivList(baslangic: string, bitis: string): Promise<{ list: EFatura[]; hata?: string; bilgi?: string }> {
  try {
    const first = await earsivPage(baslangic, bitis, 0);
    if (typeof first === 'string') return { list: [], hata: first };
    const pages: Sayfa[] = [first];
    if (first.ham >= EARSIV_PAGE) {
      const probe = await earsivPage(baslangic, bitis, 1);
      if (typeof probe === 'string') return { list: first.list, hata: probe };
      const ids = new Set(first.list.map((f) => f.ettn));
      const offset = probe.list.filter((f) => ids.has(f.ettn)).length > EARSIV_PAGE / 2;
      let page = offset ? first : probe;
      if (!offset) pages.push(probe);
      // En fazla 20 sayfa (2000 fatura/ay)
      for (let n = offset ? 1 : 2; page.ham >= EARSIV_PAGE && n < 20; n++) {
        const next = await earsivPage(baslangic, bitis, offset ? n * EARSIV_PAGE : n);
        if (typeof next === 'string') return { list: mergeLists(...pages.map((p) => p.list)), hata: next };
        pages.push(next);
        page = next;
      }
    }
    const list = mergeLists(...pages.map((p) => p.list));
    const ham = pages.reduce((n, p) => n + p.ham, 0);
    const bilgi =
      ham === 0
        ? 'QNB e-Arşiv servisi bu dönem için kayıt döndürmedi.'
        : list.length === 0
          ? `QNB e-Arşiv servisi ${ham} kayıt döndürdü ama tarihleri dönem dışında görünüyor (${first.ornek ?? '-'}).`
          : undefined;
    console.log(`e-Arşiv ${baslangic}..${bitis}: ham=${ham} liste=${list.length} ${first.ornek ?? ''}`);
    return { list, ...(bilgi ? { bilgi } : {}) };
  } catch (e) {
    return { list: [], hata: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Portaldan kesilen giden e-Faturalar. Zorunlu alanlar belgesiz: QNB "X boş olamaz" derse X bilinen
 * bir varsayılanla eklenip yeniden denenir (en fazla 4 kez). pageCount kullanılıyorsa sayfalar boşalana
 * kadar okunur. QNB iş hatasında mesaj döner; giriş hatası yukarı atılır.
 */
async function portalList(baslangic: string, bitis: string): Promise<{ list: EFatura[]; hata?: string }> {
  const { op, params } = portalListRequest(QNB_VKN, compact(baslangic), compact(bitis));
  const inRange = (f: EFatura) => !f.tarih || (f.tarih >= baslangic && f.tarih <= bitis);
  let first: EFatura[] | null = null;
  for (let attempt = 0; attempt < 4 && !first; attempt++) {
    try {
      first = parseList(await soap(QNB_URL, op, params), 'giden');
    } catch (e) {
      if (e instanceof LoginError) throw e;
      const message = e instanceof Error ? e.message : String(e);
      const field = missingField(message);
      if (!field || params[field] || !PORTAL_DEFAULTS[field]) return { list: [], hata: message };
      params[field] = PORTAL_DEFAULTS[field]!;
    }
  }
  if (!first) return { list: [], hata: 'Portal listesi alınamadı.' };
  const pages = [first];
  if (params.pageCount && first.length) {
    const seen = new Set(first.map((f) => f.ettn));
    for (let n = 2; n <= 20; n++) {
      let next: EFatura[];
      try {
        next = parseList(await soap(QNB_URL, op, { ...params, pageCount: String(n) }), 'giden');
      } catch (e) {
        if (e instanceof LoginError) throw e;
        break;
      }
      const fresh = next.filter((f) => !seen.has(f.ettn));
      if (!fresh.length) break;
      fresh.forEach((f) => seen.add(f.ettn));
      pages.push(fresh);
    }
  }
  const list = mergeLists(...pages).filter(inRange);
  console.log(`giden portal ${baslangic}..${bitis}: ${list.length} [${Object.keys(params).join(',')}]`);
  return { list };
}

/**
 * Eksik tutar/unvan/tarih tamamlama. Giden'de önce gidenBelgeTutarBilgileriSorgula (gönderim tarihi; aralık
 * 10 gün uzatılır), sonra en fazla 25 fatura için UBL (5'erli paralel). Hata olursa sessizce geçilir.
 */
async function tutarlariTamamla(list: EFatura[], yon: Yon, baslangic: string, bitis: string): Promise<void> {
  const unvansiz = (f: EFatura) => !f.unvan || f.unvan === f.vkn || /^\d{10,11}$/.test(f.unvan);
  const kdvsiz = (f: EFatura) => typeof f.kdv !== 'number';
  const eksikler = () => list.filter((f) => (!f.tutar || unvansiz(f) || !f.tarih || kdvsiz(f)) && f.ettn && f.tur !== 'earsiv');
  if (!eksikler().length) return;
  if (yon === 'giden') {
    try {
      const { op, params } = tutarRequest(QNB_VKN, compact(baslangic), compact(sonraki(bitis, 10)));
      const map = parseTutarMap(await soap(QNB_URL, op, params, { wrap: false }));
      for (const f of eksikler()) {
        const t = map.get(f.ettn);
        if (t && !f.tutar) Object.assign(f, t);
      }
    } catch (e) {
      if (e instanceof LoginError) return;
      console.log('tutar sorgusu:', e instanceof Error ? e.message : e);
    }
  }
  const kalan = eksikler().slice(0, 25);
  for (let i = 0; i < kalan.length; i += 5) {
    const sonuc = await Promise.allSettled(
      kalan.slice(i, i + 5).map(async (f) => {
        const d = parseUbl(new TextDecoder('utf-8').decode(await belge('efatura', yon, f.ettn, 'UBL')));
        const karsi = yon === 'gelen' ? { unvan: d.saticiUnvan, vkn: d.saticiVkn } : { unvan: d.aliciUnvan, vkn: d.aliciVkn };
        if (!f.tutar && d.odenecek) Object.assign(f, { tutar: d.odenecek, paraBirimi: d.paraBirimi });
        if (kdvsiz(f) && typeof d.kdvToplam === 'number') {
          f.kdv = d.kdvToplam;
          f.matrah = d.araToplam;
        }
        if (unvansiz(f)) f.unvan = karsi.unvan || f.unvan;
        f.vkn ||= karsi.vkn;
        f.belgeNo ||= d.belgeNo;
        f.tarih ||= d.tarih;
      }),
    );
    if (sonuc.some((r) => r.status === 'rejected' && r.reason instanceof LoginError)) return;
    for (const r of sonuc) if (r.status === 'rejected') console.log('UBL:', r.reason instanceof Error ? r.reason.message : r.reason);
  }
}

/** QNB'nin dönemdeki e-Fatura sayısı (toplamBelgeSayisiGetir); alınamazsa null */
async function qnbSayisi(yon: Yon, baslangic: string, bitis: string): Promise<number | null> {
  try {
    const xml = await soap(
      QNB_URL,
      'toplamBelgeSayisiGetir',
      { vergiTcKimlikNo: QNB_VKN, belgeTuru: 'FATURA', belgeYonu: yon === 'gelen' ? 'GELEN' : 'GIDEN', belgeBaslangicTarihi: compact(baslangic), belgeBitisTarihi: compact(bitis) },
      { wrap: false },
    );
    const n = xml.match(/<return>(\d+)<\/return>/)?.[1];
    return n ? Number(n) : null;
  } catch (e) {
    if (e instanceof LoginError) throw e;
    console.log('belge sayısı:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Gelen'de listede olmayan (taşınmış) faturalar: fatura tarihine göre tutar sorgusu ETTN'leri verir */
async function gelenTarama(baslangic: string, bitis: string): Promise<{ list: EFatura[]; not: string }> {
  try {
    const xml = await soap(
      QNB_URL,
      'gelenBelgeTutarBilgileriFaturaTarihineGoreSorgula',
      { vergiTcKimlikNo: QNB_VKN, belgeTuru: 'FATURA', baslangicFaturaTarihi: compact(baslangic), bitisFaturaTarihi: compact(bitis) },
      { wrap: false },
    );
    const list = parseReturns(xml)
      .filter((r) => r.ettn)
      .map((r) => ({
        ettn: r.ettn!,
        belgeNo: r.belgeNo ?? '',
        tarih: isoDate(r.belgeTarihi),
        unvan: '',
        vkn: r.gondericiVkn ?? '',
        tutar: parseTutar(r.odenecekTutar) || 0,
        paraBirimi: r.odenecekTutarDovizCinsi || 'TRY',
        profil: '',
      }));
    return { list, not: `tutar sorgusu (fatura tarihi): ${list.length}` };
  } catch (e) {
    if (e instanceof LoginError) throw e;
    return { list: [], not: `tutar sorgusu: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}` };
  }
}

/** YYYY-MM-DD + gün (bugünü geçmez) */
function sonraki(d: string, gun: number): string {
  return new Date(Math.min(Date.parse(d) + gun * 86_400_000, Date.now())).toISOString().slice(0, 10);
}

/**
 * Giden listesi boşsa ek tarama: QNB'nin belge sayısı, portal (gönderim tarihine göre),
 * web servis (belge tarihine göre), e-Arşiv (oluşturma zamanına göre). Bulunanlar fatura tarihi
 * döneme düşüyorsa eklenir; her sorgunun sonucu nota yazılır (tanı için).
 */
async function gidenTarama(baslangic: string, bitis: string): Promise<{ list: EFatura[]; notlar: string[] }> {
  const notlar: string[] = [];
  const bulunan: EFatura[][] = [];
  const inRange = (f: EFatura) => !f.tarih || (f.tarih >= baslangic && f.tarih <= bitis);
  const b = compact(baslangic), e = compact(bitis), e15 = compact(sonraki(bitis, 15));
  const dene = async (ad: string, fn: () => Promise<EFatura[] | string>) => {
    try {
      const r = await fn();
      if (typeof r === 'string') notlar.push(`${ad}: ${r}`);
      else {
        const l = r.filter(inRange);
        notlar.push(`${ad}: ${l.length}${r.length !== l.length ? ` (dönem dışı ${r.length - l.length})` : ''}`);
        bulunan.push(l);
      }
    } catch (err) {
      if (err instanceof LoginError) throw err;
      notlar.push(`${ad}: ${(err instanceof Error ? err.message : String(err)).slice(0, 200)}`);
    }
  };
  await dene('portal (gönderim tarihi)', async () =>
    parseList(
      await soap(QNB_URL, 'gidenBelgeleriListelePortal', {
        vergiTcKimlikNo: QNB_VKN,
        belgeTuru: 'FATURA',
        belgeVersiyon: '1.0',
        baslangicGonderimTarihi: b,
        bitisGonderimTarihi: e15,
      }),
      'giden',
    ),
  );
  await dene('web servis (belge tarihi)', async () =>
    parseList(await soap(QNB_URL, 'gidenBelgeleriListele', { vkn: QNB_VKN, belgeTuru: 'FATURA', baslangicBelgeTarihi: b, bitisBelgeTarihi: e }), 'giden'),
  );
  // Eski (taşınmış) belgeler listelerde yok; tutar ve durum sorguları ETTN'lerini verebilir
  await dene('tutar sorgusu (gönderim tarihi)', async () => {
    const { op, params } = tutarRequest(QNB_VKN, b, e15);
    return parseReturns(await soap(QNB_URL, op, params, { wrap: false }))
      .filter((r) => r.ettn)
      .map((r) => ({
        ettn: r.ettn!,
        belgeNo: r.belgeNo ?? '',
        tarih: isoDate(r.belgeTarihi),
        unvan: '',
        vkn: '',
        tutar: parseTutar(r.odenecekTutar) || 0,
        paraBirimi: r.odenecekTutarDovizCinsi || 'TRY',
        profil: '',
      }));
  });
  await dene('durum sorgusu (oluşturulma tarihi)', async () =>
    parseReturns(
      await soap(QNB_URL, 'gidenBelgeDurumSorgulaPortal', {
        vknTckn: QNB_VKN,
        belgeTuru: 'FATURA',
        belgeVersiyon: '1.0',
        baslangicOlusturulmaTarihi: b,
        bitisOlusturulmaTarihi: e15,
      }),
    )
      .filter((r) => r.ettn)
      .map((r) => ({
        ettn: r.ettn!,
        belgeNo: r.belgeNo ?? '',
        // Durum kaydında fatura tarihi yok; UBL'den tamamlanır
        tarih: '',
        unvan: '',
        vkn: '',
        tutar: 0,
        paraBirimi: 'TRY',
        profil: '',
      })),
  );
  await dene('e-Arşiv (oluşturma zamanı)', async () => {
    const input = { mukellefVkn: QNB_VKN, creationTimeBaslangic: `${b}000000`, creationTimeBitis: `${e15}235959`, pagingStart: 0, pagingLimit: EARSIV_PAGE };
    const xml = await soap(EARSIV_URL, 'faturaListeSorgula', { input: JSON.stringify(input) }, { earsiv: true });
    const r = parseEarsivResult(xml);
    if (r.code && r.code !== EARSIV_OK) return `${r.code}: ${(r.text || '').slice(0, 200)}`;
    return parseEarsivPage(xml, '0000-00-00', '9999-12-31').list;
  });
  return { list: mergeLists(...bulunan), notlar };
}

/**
 * Tutar/KDV satırları. Gelen: fatura tarihine göre; giden: gönderim tarihine göre. QNB tek seferde en fazla
 * 100 satır döndürdüğü için 100'e ulaşan aralık ikiye bölünüp yeniden sorulur.
 */
async function tutarSatirlari(yon: Yon, baslangic: string, bitis: string, derinlik = 0): Promise<TutarSatiri[]> {
  const { op, params } = yon === 'gelen' ? gelenTutarRequest(QNB_VKN, compact(baslangic), compact(bitis)) : tutarRequest(QNB_VKN, compact(baslangic), compact(bitis));
  let rows: TutarSatiri[];
  try {
    rows = parseTutarRows(await soap(QNB_URL, op, params, { wrap: false }));
  } catch (e) {
    if (e instanceof QnbError && /sonuç bulunamadı|bulunamadı/i.test(e.message)) return [];
    throw e;
  }
  if (rows.length < 100 || baslangic >= bitis || derinlik > 8) return rows;
  const orta = new Date((Date.parse(baslangic) + Date.parse(bitis)) / 2).toISOString().slice(0, 10);
  const ertesi = new Date(Date.parse(orta) + 86_400_000).toISOString().slice(0, 10);
  const [a, b] = await Promise.all([tutarSatirlari(yon, baslangic, orta, derinlik + 1), tutarSatirlari(yon, ertesi, bitis, derinlik + 1)]);
  const seen = new Set<string>();
  return [...a, ...b].filter((r) => !seen.has(r.ettn.toLowerCase()) && seen.add(r.ettn.toLowerCase()));
}

/** Listedeki e-Faturalara KDV ve matrahı ekler (QNB tutar bilgisinden). Hata olursa sessizce geçilir. */
async function kdvEkle(list: EFatura[], yon: Yon, baslangic: string, bitis: string): Promise<void> {
  if (!list.some((f) => f.tur !== 'earsiv')) return;
  try {
    const rows = await tutarSatirlari(yon, baslangic, yon === 'giden' ? sonraki(bitis, 15) : bitis);
    const map = new Map(rows.map((r) => [r.ettn.toLowerCase(), r]));
    for (const f of list) {
      const r = map.get(f.ettn.toLowerCase());
      if (!r || f.tur === 'earsiv') continue;
      f.kdv = r.kdv;
      f.matrah = r.matrah;
      if (r.tevkifat) f.tevkifat = r.tevkifat;
      if (!f.tutar) Object.assign(f, { tutar: r.odenecek, paraBirimi: r.paraBirimi });
    }
  } catch (e) {
    if (e instanceof LoginError) throw e;
    console.log('KDV bilgisi:', e instanceof Error ? e.message : e);
  }
}

/** İlk belgenin ayı: yıllık sayımla ilk dolu yıl, sonra o yılın ayları */
async function ilkAy(): Promise<string | null> {
  const buYil = new Date().getFullYear();
  for (let y = 2015; y <= buYil; y++) {
    const [ge, gi] = await Promise.all([qnbSayisi('gelen', `${y}-01-01`, `${y}-12-31`), qnbSayisi('giden', `${y}-01-01`, `${y}-12-31`)]);
    if (!(ge || gi)) continue;
    for (let m = 1; m <= 12; m++) {
      const a = `${y}-${String(m).padStart(2, '0')}-01`;
      const b = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      const [g1, g2] = await Promise.all([qnbSayisi('gelen', a, b), qnbSayisi('giden', a, b)]);
      if (g1 || g2) return a.slice(0, 7);
    }
  }
  return null;
}

async function ozetGelen(baslangic: string, bitis: string) {
  const [gelen, qnb] = await Promise.all([tutarSatirlari('gelen', baslangic, bitis), qnbSayisi('gelen', baslangic, bitis)]);
  return { gelen: gelen.filter((r) => !r.tarih || (r.tarih >= baslangic && r.tarih <= bitis)), qnb };
}

/**
 * Giden özet: tutar satırları (gönderim tarihi bugüne kadar sorulur, fatura tarihine göre süzülür),
 * belge tipi (SATIS/IADE) portal listesinden, olmayanlar UBL'den; e-Arşiv faturaları yıl yıl.
 */
async function ozetGiden(baslangic: string, bitis: string) {
  const bugun = new Date().toISOString().slice(0, 10);
  const [tum, qnb] = await Promise.all([tutarSatirlari('giden', baslangic, bugun), qnbSayisi('giden', baslangic, bitis)]);
  const giden = tum.filter((r) => !r.tarih || (r.tarih >= baslangic && r.tarih <= bitis));
  const tipler = new Map<string, string>();
  const earsiv: EFatura[] = [];
  let taslak = 0;
  for (let y = Number(baslangic.slice(0, 4)); y <= Number(bitis.slice(0, 4)); y++) {
    const a = `${y}-01-01` < baslangic ? baslangic : `${y}-01-01`;
    const b = `${y}-12-31` > bitis ? bitis : `${y}-12-31`;
    const portal = await portalList(a, b);
    for (const f of portal.list) if (f.tip) tipler.set(f.ettn.toLowerCase(), f.tip);
    taslak += portal.list.filter((f) => f.taslak).length;
    const e = await earsivList(a, b);
    earsiv.push(...e.list);
  }
  const eksik = giden.filter((r) => !tipler.has(r.ettn.toLowerCase())).slice(0, 30);
  for (let i = 0; i < eksik.length; i += 5) {
    await Promise.allSettled(
      eksik.slice(i, i + 5).map(async (r) => {
        const d = parseUbl(new TextDecoder('utf-8').decode(await belge('efatura', 'giden', r.ettn, 'UBL')));
        if (d.tip) tipler.set(r.ettn.toLowerCase(), d.tip);
      }),
    );
  }
  for (const r of giden) r.tip = tipler.get(r.ettn.toLowerCase()) ?? 'SATIS';
  return { giden, earsiv: mergeLists(earsiv), qnb, taslak };
}

const donemde = (baslangic: string, bitis: string) => (f: EFatura) => !f.tarih || (f.tarih >= baslangic && f.tarih <= bitis);

/**
 * Dönemin faturaları. QNB'nin saydığı e-Fatura sayısı (toplamBelgeSayisiGetir) listedekinden fazlaysa
 * (eski belgeler listelerden "taşınıyor") ek tarama yapılır; yine eksik kalırsa uyarı döner.
 * kontrol: { qnb, liste } — QNB'nin saydığı ve listede gösterilen e-Fatura sayısı (e-Arşiv hariç).
 */
async function listele(yon: Yon, baslangic: string, bitis: string) {
  const { op, params } = listRequest(yon, QNB_VKN, compact(baslangic), compact(bitis));
  const [liste, qnb] = await Promise.all([soap(QNB_URL, op, params).then((x) => parseList(x, yon)), qnbSayisi(yon, baslangic, bitis)]);
  const uyarilar: string[] = [];
  const notlar: string[] = [];
  let efatura = liste;
  let earsiv: Awaited<ReturnType<typeof earsivList>> = { list: [] };
  /** Gönderilmemiş taslaklar: QNB sayısına dahil, listede gösterilmez */
  let taslak = 0;

  if (yon === 'giden') {
    const portal = await portalList(baslangic, bitis);
    earsiv = await earsivList(baslangic, bitis);
    if (portal.hata) uyarilar.push(`Portal e-Faturaları alınamadı: ${portal.hata}`);
    if (earsiv.hata) uyarilar.push(`e-Arşiv faturaları alınamadı: ${earsiv.hata}`);
    efatura = mergeLists(liste, portal.list);
    notlar.push(`e-Fatura: web servis ${liste.length}, portal ${portal.list.length} kayıt.`);
    if (earsiv.bilgi) notlar.push(earsiv.bilgi);
    taslak = efatura.filter((f) => f.taslak).length;
    efatura = efatura.filter((f) => !f.taslak);
    if (qnb === null ? !efatura.length && !earsiv.list.length : efatura.length + taslak < qnb) {
      const tarama = await gidenTarama(baslangic, bitis);
      efatura = mergeLists(efatura, tarama.list).filter((f) => !f.taslak);
      notlar.push(`Ek tarama — ${tarama.notlar.join(' · ')}`);
    }
  } else if (qnb !== null && efatura.length < qnb) {
    const tarama = await gelenTarama(baslangic, bitis);
    efatura = mergeLists(efatura, tarama.list);
    notlar.push(`Ek tarama — ${tarama.not}`);
  }

  await kdvEkle(efatura, yon, baslangic, bitis);
  await tutarlariTamamla(efatura, yon, baslangic, bitis);
  efatura = efatura.filter(donemde(baslangic, bitis));
  for (const f of efatura) f.unvan ||= f.vkn || (yon === 'gelen' ? 'Bilinmeyen satıcı' : 'Bilinmeyen alıcı');

  if (qnb !== null && efatura.length + taslak < qnb) {
    const eksik = qnb - efatura.length - taslak;
    uyarilar.push(`QNB bu dönemde ${qnb} ${yon} e-Fatura sayıyor, listede ${efatura.length}${taslak ? ` (+${taslak} gönderilmemiş taslak)` : ''} var. Eksik ${eksik} fatura bulunamadı.`);
  }
  console.log(`${yon} ${baslangic}..${bitis}: qnb=${qnb} liste=${efatura.length} taslak=${taslak} ${notlar.join(' | ')}`);
  return {
    faturalar: mergeLists(efatura, earsiv.list),
    kontrol: { qnb, liste: efatura.length, taslak },
    ...(uyarilar.length ? { uyari: uyarilar.join('\n\n') } : {}),
    ...(notlar.length && (yon === 'giden' || efatura.length < (qnb ?? 0) || notlar.some((n) => n.startsWith('Ek'))) ? { bilgi: notlar.join('\n\n') } : {}),
  };
}

type Tur = 'efatura' | 'earsiv';

/** Tek faturanın kendisi (UBL ya da PDF), ham bayt olarak */
async function belge(tur: Tur, yon: Yon, ettn: string, format: 'UBL' | 'PDF'): Promise<Uint8Array> {
  const unzipped = (b64: string) => extractFile(base64ToBytes(b64), unzipSync, format === 'PDF' ? 'pdf' : 'xml');
  if (tur === 'efatura') {
    const { op, params } = detailRequest(yon, QNB_VKN, ettn, format);
    let ilkHata = '';
    try {
      const b64 = parseBase64Return(await soap(QNB_URL, op, params, { wrap: false }));
      if (b64) return unzipped(b64);
      ilkHata = 'QNB faturanın içeriğini döndürmedi.';
    } catch (e) {
      if (e instanceof LoginError) throw e;
      ilkHata = e instanceof Error ? e.message : String(e);
    }
    // Eski belgeler "taşınan belgeler"e alınıyor; onlar ETTN ile ayrı metottan indirilir
    try {
      const tasinan = yon === 'gelen' ? 'gelenTasinanBelgeleriIndir' : 'gidenTasinanBelgeleriIndir';
      const b64 = parseBase64Return(
        await soap(QNB_URL, tasinan, { vergiTcKimlikNo: QNB_VKN, ettnler: ettn, belgeFormati: format }, { wrap: false }),
      );
      if (b64) return unzipped(b64);
    } catch (e) {
      if (e instanceof LoginError) throw e;
      console.log('taşınan belge:', e instanceof Error ? e.message : e);
    }
    throw new QnbError(ilkHata);
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
  try {
    if (b.islem === 'ilk-ay') return reply(200, { ilkAy: await ilkAy() });
    if (b.islem === 'ozet-gelen' || b.islem === 'ozet-giden') {
      const a = b.baslangic, z = b.bitis;
      const gun = typeof a === 'string' && typeof z === 'string' && DATE_RE.test(a) && DATE_RE.test(z) ? (Date.parse(z) - Date.parse(a)) / 86_400_000 : -1;
      if (gun < 0 || gun > (b.islem === 'ozet-gelen' ? MAX_DAYS : 6 * 366)) return reply(400, { message: 'Tarih aralığı geçersiz.' });
      return reply(200, b.islem === 'ozet-gelen' ? await ozetGelen(a as string, z as string) : await ozetGiden(a as string, z as string));
    }
  } catch (e) {
    if (e instanceof LoginError) return reply(502, { code: 'qnb_login', message: e.message });
    return reply(502, { message: e instanceof Error ? e.message : String(e) });
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
