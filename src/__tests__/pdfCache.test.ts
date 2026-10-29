import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  cacheKey,
  clearPdfCache,
  fetchInvoicePdf,
  getCachedPdf,
  isPdfCached,
  prefetchInvoicePdf,
  setCachedPdf,
  setPdfInvoker,
} from '../services/efatura/pdfCache';

describe('pdfCache', () => {
  beforeEach(() => {
    clearPdfCache();
    setPdfInvoker(null);
  });

  it('başlangıçta önbellek boştur ve tanımsız döner', () => {
    assert.equal(isPdfCached('gelen', 'fake-ettn-001'), false);
    assert.equal(getCachedPdf('gelen', 'fake-ettn-001'), undefined);
  });

  it('büyük-küçük harf duyarsız ETTN anahtarlaması yapar', () => {
    assert.equal(cacheKey('gelen', 'ETTN-ABC-123'), 'gelen:ettn-abc-123:efatura');
    assert.equal(cacheKey('giden', 'ettn-xyz', 'earsiv'), 'giden:ettn-xyz:earsiv');

    setCachedPdf('gelen', 'ETTN-ABC-123', {
      base64: 'dGVzdA==',
      bytes: new Uint8Array([116, 101, 115, 116]),
    });

    assert.equal(isPdfCached('gelen', 'ettn-abc-123'), true);
    assert.equal(getCachedPdf('gelen', 'ETTN-ABC-123')?.base64, 'dGVzdA==');
  });

  it('clearPdfCache önbelleği temizler', () => {
    setCachedPdf('gelen', 'ettn-1', {
      base64: 'abc',
      bytes: new Uint8Array([1]),
    });
    assert.equal(isPdfCached('gelen', 'ettn-1'), true);
    clearPdfCache();
    assert.equal(isPdfCached('gelen', 'ettn-1'), false);
  });

  it('fetchInvoicePdf özel invoker ile çalışır ve sonucu önbelleğe alır', async () => {
    let callCount = 0;
    const mockInvoker = async () => {
      callCount++;
      return { data: { pdf: 'JVBERi0xLjQK' }, error: null };
    };

    const res1 = await fetchInvoicePdf('gelen', 'ettn-test-1', 'efatura', mockInvoker);
    assert.equal(res1.base64, 'JVBERi0xLjQK');
    assert.equal(callCount, 1);
    assert.equal(isPdfCached('gelen', 'ettn-test-1'), true);

    // İkinci çağrı doğrudan önbellekten gelmeli, invoker tekrar çağrılmamalı
    const res2 = await fetchInvoicePdf('gelen', 'ettn-test-1', 'efatura', mockInvoker);
    assert.equal(res2.base64, 'JVBERi0xLjQK');
    assert.equal(callCount, 1);
  });

  it('eşzamanlı istekler birleştirilir (deduplication)', async () => {
    let callCount = 0;
    const mockInvoker = async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 20));
      return { data: { pdf: 'JVBERi0=' }, error: null };
    };

    const [p1, p2, p3] = await Promise.all([
      fetchInvoicePdf('gelen', 'dedupe-ettn', 'efatura', mockInvoker),
      fetchInvoicePdf('gelen', 'dedupe-ettn', 'efatura', mockInvoker),
      fetchInvoicePdf('gelen', 'dedupe-ettn', 'efatura', mockInvoker),
    ]);

    assert.equal(callCount, 1);
    assert.equal(p1.base64, 'JVBERi0=');
    assert.equal(p2.base64, 'JVBERi0=');
    assert.equal(p3.base64, 'JVBERi0=');
  });

  it('prefetchInvoicePdf hata fırlatmaz (sessizce arka planda çalışır)', () => {
    assert.doesNotThrow(() => {
      prefetchInvoicePdf('gelen', 'some-ettn');
    });
  });
});
