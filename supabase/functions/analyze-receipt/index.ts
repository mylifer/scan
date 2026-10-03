// Supabase Edge Function: fiş fotoğrafını Gemini ile okur. Gemini anahtarı sunucuda (Supabase secret)
// durur, uygulama paketine girmez. Yalnızca giriş yapmış kullanıcılar çağırabilir (verify_jwt varsayılan).
//
// Kurulum: GitHub Actions → "Supabase fonksiyonunu yayınla" iş akışı (SUPABASE_ACCESS_TOKEN secret'ı gerekir)
// ya da: supabase functions deploy analyze-receipt && supabase secrets set GEMINI_API_KEY=...
// Uygulamada kullanmak için: EXPO_PUBLIC_VISION_PROVIDER=edge

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
/** İstemcideki zincirle aynı: asıl model yoğunsa sırayla yedekler */
const MODELS = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
/** ~6 MB base64 görsel sınırı (uygulama ~300 KB gönderir); kötüye kullanıma karşı */
const MAX_IMAGE_CHARS = 8_000_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  image: string;
  mimeType: 'image/jpeg' | 'image/png';
  system: string;
  user: string;
  schema: unknown;
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function generate(model: string, b: Body) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: b.system }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: b.mimeType, data: b.image } }, { text: b.user }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: b.schema, temperature: 0 },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { status: res.status, message: json?.error?.message ?? `HTTP ${res.status}` };
  const text = json?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
  return text ? { text } : { status: 502, message: 'Gemini boş yanıt döndürdü.' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { message: 'Yalnızca POST' });
  if (!GEMINI_KEY) return reply(500, { message: 'Sunucuda GEMINI_API_KEY tanımlı değil.' });

  let b: Body;
  try {
    b = await req.json();
  } catch {
    return reply(400, { message: 'Geçersiz istek gövdesi.' });
  }
  if (typeof b.image !== 'string' || !b.image || b.image.length > MAX_IMAGE_CHARS) return reply(400, { message: 'Görsel eksik ya da çok büyük.' });
  if (b.mimeType !== 'image/jpeg' && b.mimeType !== 'image/png') return reply(400, { message: 'Desteklenmeyen görsel türü.' });
  if (typeof b.system !== 'string' || typeof b.user !== 'string') return reply(400, { message: 'İstem eksik.' });

  let firstTransient: { status: number; message: string } | null = null;
  let last: { status: number; message: string } | null = null;
  for (const [i, model] of MODELS.entries()) {
    const r = await generate(model, b);
    if ('text' in r) return reply(200, { text: r.text, model });
    last = r;
    if (TRANSIENT.has(r.status)) {
      firstTransient ??= r;
      continue;
    }
    // Asıl modelin kalıcı hatası ya da anahtar hatası zinciri keser; yedeğin kalıcı hatası (ör. 404) atlanır
    if (i === 0 || r.status === 401 || r.status === 403) break;
  }
  const cause = firstTransient ?? last ?? { status: 500, message: 'Bilinmeyen hata' };
  return reply(cause.status, { message: cause.message });
});
