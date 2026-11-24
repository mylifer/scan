// Fatura kesme sunucu fonksiyonunun (qnb-fatura-kes) istemci tarafı. Web ve (ileride) mobil ortak kullanır.
import type { FaturaGirdi, Taraf } from '../../../supabase/functions/qnb-fatura-kes/ubl';

export {
  BILINMEYEN_TCKN,
  BIRIMLER,
  KDV_ORANLARI,
  dogrula,
  hesapla,
  sahisMi,
  tcknGecerli,
  vknGecerli,
} from '../../../supabase/functions/qnb-fatura-kes/ubl';
export type { FaturaGirdi, FaturaTuru, Kalem, Senaryo, Taraf, Toplamlar } from '../../../supabase/functions/qnb-fatura-kes/ubl';

export type KesimOrtami = 'kapali' | 'test' | 'canli';

export interface KesimSonucu {
  tur: 'efatura' | 'earsiv';
  ettn: string;
  belgeNo: string;
  belgeOid?: string;
  durum: string;
  faturaUrl?: string;
  ortam: KesimOrtami;
}

/** supabase.functions.invoke ile aynı biçim (testte sahtelenebilsin diye dışarıdan verilir) */
export type KesInvokeFn = (
  name: string,
  options: { body: Record<string, unknown> },
) => Promise<{ data: unknown; error: unknown }>;

export class FaturaKesError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly hatalar: string[] = [],
  ) {
    super(message);
    this.name = 'FaturaKesError';
  }
}

async function call<T>(invoke: KesInvokeFn, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await invoke('qnb-fatura-kes', { body });
  if (error) {
    const ctx = (error as { context?: { status?: number; json?: () => Promise<{ message?: string; code?: string; hatalar?: string[] }> } })?.context;
    let message = error instanceof Error ? error.message : String(error);
    let code: string | undefined;
    let hatalar: string[] = [];
    if (ctx?.json) {
      const b = await ctx.json().catch(() => null);
      if (b?.message) message = b.message;
      code = b?.code;
      if (Array.isArray(b?.hatalar)) hatalar = b.hatalar;
    }
    if (ctx?.status === 401) message = 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.';
    if (ctx?.status === 404) message = 'Fatura kesme sunucu fonksiyonu (qnb-fatura-kes) henüz yayınlanmamış.';
    throw new FaturaKesError(message, code, hatalar);
  }
  return data as T;
}

export async function kesimDurumu(invoke: KesInvokeFn): Promise<{ ortam: KesimOrtami; saticiVkn: string | null }> {
  return call(invoke, { islem: 'durum' });
}

/** Alıcı e-Fatura mükellefi mi (true → e-Fatura, false → e-Arşiv kesilir) */
export async function mukellefSorgula(invoke: KesInvokeFn, vknTckn: string): Promise<boolean> {
  const d = await call<{ efatura?: boolean }>(invoke, { islem: 'mukellef', vknTckn });
  if (typeof d?.efatura !== 'boolean') throw new FaturaKesError('Sunucu beklenmeyen bir yanıt döndürdü.');
  return d.efatura;
}

/** Göndermeden önce sunucuda denetim ve QNB'ye gidecek XML */
export async function onizle(invoke: KesInvokeFn, fatura: FaturaGirdi, satici: Omit<Taraf, 'vknTckn'>): Promise<{ xml: string }> {
  return call(invoke, { islem: 'onizle', fatura, satici });
}

export async function faturaKes(
  invoke: KesInvokeFn,
  fatura: FaturaGirdi,
  satici: Omit<Taraf, 'vknTckn'>,
  seri: string,
  ortam: KesimOrtami,
): Promise<KesimSonucu> {
  const d = await call<{ sonuc?: KesimSonucu }>(invoke, { islem: 'kes', fatura, satici, seri, ortam, onay: true });
  if (!d?.sonuc) throw new FaturaKesError('Sunucu beklenmeyen bir yanıt döndürdü.');
  return d.sonuc;
}

/** Türkiye saatiyle bugünün tarihi ve şimdiki saat */
export function simdiIstanbul(now = Date.now()): { tarih: string; saat: string } {
  const iso = new Date(now + 3 * 3600_000).toISOString();
  return { tarih: iso.slice(0, 10), saat: iso.slice(11, 19) };
}
