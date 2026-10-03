import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GeminiVisionAdapter } from '../services/vision/GeminiVisionAdapter';
import { VisionServiceError } from '../services/vision/VisionService';

const image = { base64: 'x', mimeType: 'image/jpeg' as const };
const ok = JSON.stringify({ firmaAdi: 'A', tarih: '01.09.2026', toplamTutar: 10, kdvYuzde1: 0, kdvYuzde10: 0, kdvYuzde20: 1, kategori: 'market' });
const err = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

/** generate'i sahteleyip model başına sonuç/hata veren adaptör */
function adapter(results: Record<string, number | 'ok'>) {
  const a = new GeminiVisionAdapter('test-key');
  const calls: string[] = [];
  (a as unknown as { generate: (m: string) => Promise<string> }).generate = async (model: string) => {
    calls.push(model);
    const r = results[model] ?? 503;
    if (r === 'ok') return ok;
    throw err(r);
  };
  return { a, calls };
}

describe('Gemini yedek model zinciri', () => {
  it('yedek modelin 404 hatası zinciri kesmez', async () => {
    const { a, calls } = adapter({ 'gemini-2.5-flash': 503, 'gemini-3.6-flash': 404, 'gemini-3.5-flash-lite': 'ok' });
    const d = await a.analyzeReceipt(image);
    assert.equal(d.firmaAdi, 'A');
    assert.deepEqual(calls, ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']);
  });

  it('hepsi başarısızsa ilk geçici hata (yoğun) bildirilir', async () => {
    const { a } = adapter({ 'gemini-2.5-flash': 503, 'gemini-3.6-flash': 404, 'gemini-3.5-flash-lite': 404, 'gemini-flash-lite-latest': 400 });
    await assert.rejects(a.analyzeReceipt(image), (e: unknown) => e instanceof VisionServiceError && e.kind === 'busy');
  });

  it('asıl modelin kalıcı hatası ve anahtar hatası hemen bildirilir', async () => {
    const first = adapter({ 'gemini-2.5-flash': 400 });
    await assert.rejects(first.a.analyzeReceipt(image), (e: unknown) => e instanceof VisionServiceError && e.kind === 'other');
    assert.equal(first.calls.length, 1);
    const auth = adapter({ 'gemini-2.5-flash': 503, 'gemini-3.6-flash': 403 });
    await assert.rejects(auth.a.analyzeReceipt(image));
    assert.equal(auth.calls.length, 2);
  });

  it('kota (429) hatası quota olarak sınıflanır', async () => {
    const { a } = adapter({ 'gemini-2.5-flash': 429, 'gemini-3.6-flash': 429, 'gemini-3.5-flash-lite': 429, 'gemini-flash-lite-latest': 429 });
    await assert.rejects(a.analyzeReceipt(image), (e: unknown) => e instanceof VisionServiceError && e.kind === 'quota');
  });
});
