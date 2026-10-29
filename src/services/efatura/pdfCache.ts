import { base64ToBytes } from '../../../supabase/functions/qnb-efatura/soap';
import { getEFaturaPdf, type InvokeFn, type Tur, type Yon } from './qnbEfatura';

export interface CachedPdf {
  base64: string;
  blobUrl?: string;
  bytes: Uint8Array;
}

const memoryCache = new Map<string, CachedPdf>();
const inflight = new Map<string, Promise<CachedPdf>>();

let customInvoker: InvokeFn | null = null;

export function setPdfInvoker(invoker: InvokeFn | null) {
  customInvoker = invoker;
}

export function cacheKey(yon: Yon, ettn: string, tur: Tur = 'efatura'): string {
  return `${yon}:${ettn.toLowerCase()}:${tur}`;
}

/** Bu faturanın PDF'i önbellekte var mı? */
export function isPdfCached(yon: Yon, ettn: string, tur: Tur = 'efatura'): boolean {
  return memoryCache.has(cacheKey(yon, ettn, tur));
}

/** Önbellekteki PDF'i döner (yoksa undefined) */
export function getCachedPdf(yon: Yon, ettn: string, tur: Tur = 'efatura'): CachedPdf | undefined {
  return memoryCache.get(cacheKey(yon, ettn, tur));
}

/** Test veya manuel önbellek doldurma */
export function setCachedPdf(yon: Yon, ettn: string, cached: CachedPdf, tur: Tur = 'efatura'): void {
  memoryCache.set(cacheKey(yon, ettn, tur), cached);
}

/** Önbelleği temizler (özellikle testler için) */
export function clearPdfCache(): void {
  memoryCache.clear();
  inflight.clear();
}

/**
 * Fatura PDF'ini getirir.
 * Önbellekte varsa anında döner; yoksa sunucudan çeker ve önbelleğe yazar.
 */
export async function fetchInvoicePdf(
  yon: Yon,
  ettn: string,
  tur: Tur = 'efatura',
  invoker?: InvokeFn,
): Promise<CachedPdf> {
  const key = cacheKey(yon, ettn, tur);
  const existing = memoryCache.get(key);
  if (existing) return existing;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const invoke: InvokeFn =
        invoker ??
        customInvoker ??
        (await (async () => {
          const { supabase } = await import('../supabase/client');
          return (name: string, options: { body: Record<string, unknown> }) => supabase.functions.invoke(name, options);
        })());

      const b64 = await getEFaturaPdf(invoke, yon, ettn, tur);
      const bytes = base64ToBytes(b64);
      let blobUrl: string | undefined;

      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        blobUrl = URL.createObjectURL(blob);
      }

      const cached: CachedPdf = { base64: b64, blobUrl, bytes };
      memoryCache.set(key, cached);
      return cached;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Arka planda sessizce önbelleğe alır (hover yapıldığında veya liste yüklendiğinde).
 */
export function prefetchInvoicePdf(yon: Yon, ettn: string, tur: Tur = 'efatura', invoker?: InvokeFn): void {
  const key = cacheKey(yon, ettn, tur);
  if (memoryCache.has(key) || inflight.has(key)) return;
  void fetchInvoicePdf(yon, ettn, tur, invoker).catch(() => {});
}
