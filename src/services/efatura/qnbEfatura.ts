import type { EFatura, FaturaDetay, Yon } from '../../../supabase/functions/qnb-efatura/soap';

export type { EFatura, FaturaDetay, Yon };

/** supabase.functions.invoke ile aynı biçim (testte sahtelenebilsin diye dışarıdan verilir) */
export type InvokeFn = (
  name: string,
  options: { body: Record<string, unknown> },
) => Promise<{ data: { faturalar?: EFatura[]; uyari?: string; bilgi?: string; detay?: FaturaDetay; pdf?: string } | null; error: unknown }>;

export class EFaturaError extends Error {
  constructor(
    message: string,
    /** QNB kullanıcı adı/şifre hatası: otomatik tekrar denenmemeli */
    readonly loginFailed = false,
  ) {
    super(message);
    this.name = 'EFaturaError';
  }
}

async function call(invoke: InvokeFn, body: Record<string, unknown>) {
  const { data, error } = await invoke('qnb-efatura', { body });
  if (error) {
    const { status, message, code } = await describeError(error);
    throw new EFaturaError(friendly(status, message), code === 'qnb_login');
  }
  return data;
}

/**
 * Sunucu fonksiyonu (qnb-efatura) üzerinden dönemin faturalarını getirir. Tarihler YYYY-MM-DD, ikisi de dahil.
 * Giden'de e-Fatura ve e-Arşiv birlikte gelir; e-Arşiv alınamazsa liste yine döner, sebebi `uyari`dadır.
 */
export async function listEFaturalar(
  invoke: InvokeFn,
  yon: Yon,
  baslangic: string,
  bitis: string,
): Promise<{ faturalar: EFatura[]; uyari?: string; bilgi?: string }> {
  const data = await call(invoke, { yon, baslangic, bitis });
  if (!Array.isArray(data?.faturalar)) throw new EFaturaError('Sunucu beklenmeyen bir yanıt döndürdü.');
  return { faturalar: data.faturalar, ...(data.uyari ? { uyari: data.uyari } : {}), ...(data.bilgi ? { bilgi: data.bilgi } : {}) };
}

export type Tur = 'efatura' | 'earsiv';

/** Faturanın kalemleri, KDV dökümü ve toplamları (UBL'den) */
export async function getEFaturaDetay(invoke: InvokeFn, yon: Yon, ettn: string, tur: Tur = 'efatura'): Promise<FaturaDetay> {
  const data = await call(invoke, { islem: 'detay', yon, ettn, tur });
  if (!data?.detay) throw new EFaturaError('Sunucu beklenmeyen bir yanıt döndürdü.');
  return data.detay;
}

/** Faturanın PDF'i (base64) */
export async function getEFaturaPdf(invoke: InvokeFn, yon: Yon, ettn: string, tur: Tur = 'efatura'): Promise<string> {
  const data = await call(invoke, { islem: 'pdf', yon, ettn, tur });
  if (typeof data?.pdf !== 'string' || !data.pdf) throw new EFaturaError('Sunucu PDF döndürmedi.');
  return data.pdf;
}

/** FunctionsHttpError'da context bir Response'tur: durum kodu ve sunucunun mesajı oradan okunur */
async function describeError(error: unknown): Promise<{ status?: number; message: string; code?: string }> {
  const ctx = (error as { context?: { status?: number; json?: () => Promise<{ message?: string; code?: string }> } })?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : undefined;
  let message = error instanceof Error ? error.message : String(error);
  let code: string | undefined;
  if (ctx?.json) {
    const body = await ctx.json().catch(() => null);
    if (body?.message) message = body.message;
    code = body?.code;
  }
  return { status, message, code };
}

function friendly(status: number | undefined, message: string): string {
  if (status === 401) return 'Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.';
  if (status === 404) return 'Sunucu fonksiyonu (qnb-efatura) bulunamadı. Kurulumu yapılmamış olabilir.';
  return message;
}

/** Dönemin toplamı (para birimine göre) */
export function totalsByCurrency(list: EFatura[]): { paraBirimi: string; toplam: number }[] {
  const m = new Map<string, number>();
  for (const f of list) m.set(f.paraBirimi, (m.get(f.paraBirimi) ?? 0) + f.tutar);
  return [...m].map(([paraBirimi, toplam]) => ({ paraBirimi, toplam: Math.round(toplam * 100) / 100 }));
}
