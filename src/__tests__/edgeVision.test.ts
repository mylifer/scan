import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EdgeFunctionVisionAdapter, type InvokeFn } from '../services/vision/EdgeFunctionVisionAdapter';
import { VisionServiceError } from '../services/vision/VisionService';

const image = { base64: 'eA==', mimeType: 'image/jpeg' as const };
const ok = JSON.stringify({ firmaAdi: 'MİGROS', tarih: '14.09.2026', toplamTutar: 337.3, kdvYuzde1: 0.57, kdvYuzde10: 0, kdvYuzde20: 46.63, kategori: 'market' });

/** FunctionsHttpError benzeri: context bir Response */
const httpError = (status: number, message: string) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: new Response(JSON.stringify({ message }), { status }) });

describe('EdgeFunctionVisionAdapter', () => {
  it('sunucunun metnini çözümler ve istem/şemayı gönderir', async () => {
    let sent: Record<string, unknown> | undefined;
    const invoke: InvokeFn = async (name, { body }) => {
      assert.equal(name, 'analyze-receipt');
      sent = body;
      return { data: { text: ok }, error: null };
    };
    const d = await new EdgeFunctionVisionAdapter(invoke).analyzeReceipt(image);
    assert.equal(d.firmaAdi, 'MİGROS');
    assert.equal(d.toplamTutar, 337.3);
    assert.equal(sent?.image, 'eA==');
    assert.ok(typeof sent?.system === 'string' && sent.schema);
  });

  it('HTTP durumuna göre hata türü: 429 quota, 503 busy, 404 other', async () => {
    for (const [status, kind] of [[429, 'quota'], [503, 'busy'], [404, 'other']] as const) {
      const invoke: InvokeFn = async () => ({ data: null, error: httpError(status, 'x') });
      await assert.rejects(new EdgeFunctionVisionAdapter(invoke).analyzeReceipt(image), (e: unknown) => e instanceof VisionServiceError && e.kind === kind);
    }
  });

  it('boş yanıtta anlaşılır hata', async () => {
    const invoke: InvokeFn = async () => ({ data: {}, error: null });
    await assert.rejects(new EdgeFunctionVisionAdapter(invoke).analyzeReceipt(image), /boş yanıt/);
  });
});
