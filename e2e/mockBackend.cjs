// Uçtan uca testler için sahte Supabase + Gemini (tarayıcı istekleri Playwright ile yakalanır).
// Uygulama e2e derlemesinde https://e2e.supabase.co adresini kullanır; gerçek veritabanına dokunulmaz.
const SUPABASE = 'https://e2e.supabase.co';
const AUTH_KEY = 'sb-e2e-auth-token';
const uid = '11111111-1111-1111-1111-111111111111';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function session(userId = uid) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, role: 'authenticated', exp: now + 3600, aud: 'authenticated' })}.sig`;
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'e2e@test.local', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  return { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user };
}

/** Bugüne göre YYYY-MM-DD (ay kaydırmalı) — testler takvimden bağımsız kalsın */
function isoDate(monthOffset, day) {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() + monthOffset, day);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function receipt(id, firma, tarih, tutar, extra = {}) {
  const kdv = Math.round(tutar * 1667) / 10000;
  return { id, user_id: uid, created_at: `${tarih}T10:00:00Z`, firma_adi: firma, tarih, toplam_tutar: tutar, kdv_yuzde1: 0, kdv_yuzde10: 0, kdv_yuzde20: kdv, toplam_kdv: kdv, kategori: 'market', image_path: null, ...extra };
}

function filterRows(rows, sp) {
  return rows.filter((r) => {
    for (const [k, v] of sp.entries()) {
      if (['select', 'order', 'limit', 'offset', 'or'].includes(k)) continue;
      if (v.startsWith('eq.') && String(r[k]) !== v.slice(3)) return false;
      if (v.startsWith('neq.') && String(r[k]) === v.slice(4)) return false;
      if (v.startsWith('in.(')) {
        const ids = v.slice(4, -1).split(',').map((x) => x.replace(/"/g, ''));
        if (!ids.includes(String(r[k]))) return false;
      }
      if (v.startsWith('gte.') && !(String(r[k]) >= v.slice(4))) return false;
      if (v.startsWith('lt.') && !(String(r[k]) < v.slice(3))) return false;
    }
    return true;
  });
}

/**
 * Sayfaya sahte arka ucu kurar.
 * @param opts.receipts başlangıç fişleri; opts.schema veritabanı kurulum sürümü (0 = kurulum yok);
 *        opts.gemini (çağrı no) => yanıt nesnesi ya da { status } hata; opts.delay (url) => ms
 */
async function installBackend(page, opts = {}) {
  const state = {
    db: { receipts: [...(opts.receipts ?? [])], receipt_drafts: [] },
    storage: new Map(),
    log: [],
    geminiCalls: 0,
    userId: uid,
  };
  let n = 0;
  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });

  await page.addInitScript(([k, v]) => {
    if (!localStorage.getItem('e2e-no-session')) localStorage.setItem(k, v);
  }, [AUTH_KEY, JSON.stringify(session())]);

  await page.route('https://generativelanguage.googleapis.com/**', (route) => {
    state.geminiCalls++;
    const r = opts.gemini ? opts.gemini(state.geminiCalls) : { firmaAdi: `FİRMA ${state.geminiCalls}`, tarih: isoDate(0, 2).split('-').reverse().join('.'), toplamTutar: 100 * state.geminiCalls, kdvYuzde1: 0, kdvYuzde10: 0, kdvYuzde20: 16.67 * state.geminiCalls, kategori: 'market' };
    if (r.status) return json(route, { error: { code: r.status, message: 'mock', status: 'MOCK' } }, r.status);
    return json(route, { candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(r) }] }, finishReason: 'STOP' }] });
  });

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const m = req.method();
    const path = url.pathname;
    if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const wait = opts.delay?.(url);
    if (wait) await new Promise((r) => setTimeout(r, wait));
    if (path.startsWith('/auth/v1/user')) return json(route, session(state.userId).user);
    if (path.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    if (path.startsWith('/rest/v1/rpc/receipt_schema_version')) {
      const v = opts.schema ?? 4;
      return v ? json(route, v) : json(route, { code: 'PGRST202', message: 'Could not find the function' }, 404);
    }
    const rest = path.match(/^\/rest\/v1\/(\w+)/);
    if (rest) {
      const t = rest[1];
      const single = (req.headers()['accept'] || '').includes('pgrst.object');
      if (m === 'GET') {
        // Mükerrer kontrolü (or=...) gerçek filtreyi taklit etmez; boş döner
        if (url.searchParams.get('or')) return json(route, []);
        const rows = filterRows(state.db[t] ?? [], url.searchParams).sort((a, b) => String(b.tarih ?? '').localeCompare(String(a.tarih ?? '')));
        return json(route, single ? rows[0] ?? null : rows);
      }
      if (m === 'POST') {
        const body = JSON.parse(req.postData());
        const row = { id: `id${++n}`, created_at: new Date(Date.now() + n).toISOString(), user_id: state.userId, status: 'pending', scheduled_for: null, result: null, error: null, ...body };
        if (t === 'receipts') row.toplam_kdv = (row.kdv_yuzde1 ?? 0) + (row.kdv_yuzde10 ?? 0) + (row.kdv_yuzde20 ?? 0);
        state.db[t].push(row);
        state.log.push(`INSERT ${t}`);
        return json(route, single ? row : [row], 201);
      }
      if (m === 'PATCH') {
        const body = JSON.parse(req.postData());
        const rows = filterRows(state.db[t], url.searchParams);
        rows.forEach((r) => Object.assign(r, body));
        state.log.push(`PATCH ${t} ${body.status ?? Object.keys(body).join(',')}`);
        return single ? json(route, rows[0]) : route.fulfill({ status: 204, body: '' });
      }
      if (m === 'DELETE') {
        const rows = filterRows(state.db[t], url.searchParams);
        state.db[t] = state.db[t].filter((r) => !rows.includes(r));
        state.log.push(`DELETE ${t}`);
        return route.fulfill({ status: 204, body: '' });
      }
    }
    if (path.startsWith('/storage/v1/object/list')) return json(route, []);
    if (path.startsWith('/storage/v1/object/sign/receipt-images') && m === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.paths) return json(route, body.paths.map((p) => ({ path: p, signedURL: `/object/sign/receipt-images/${p}?token=t`, error: null })));
      return json(route, { signedURL: `/object/sign/receipt-images/${path.split('/sign/receipt-images/')[1]}?token=t` });
    }
    const obj = path.match(/^\/storage\/v1\/object\/(?:sign\/|authenticated\/)?receipt-images\/(.+)$/);
    if (obj && m === 'POST') {
      state.storage.set(decodeURIComponent(obj[1]), req.postDataBuffer());
      state.log.push(`UPLOAD ${decodeURIComponent(obj[1])}`);
      return json(route, { Key: `receipt-images/${obj[1]}` });
    }
    if (obj && m === 'GET') {
      const buf = state.storage.get(decodeURIComponent(obj[1])) ?? opts.photo;
      return buf ? route.fulfill({ status: 200, contentType: 'image/jpeg', body: buf }) : json(route, { error: 'not found' }, 404);
    }
    if (path === '/storage/v1/object/receipt-images' && m === 'DELETE') {
      const { prefixes } = JSON.parse(req.postData());
      prefixes.forEach((p) => state.storage.delete(p));
      state.log.push(`STORAGE DELETE ${prefixes.length}`);
      return json(route, []);
    }
    state.log.push(`UNHANDLED ${m} ${path}`);
    return json(route, {}, 404);
  });
  return state;
}

module.exports = { SUPABASE, AUTH_KEY, uid, session, isoDate, receipt, installBackend };
