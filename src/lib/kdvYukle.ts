import { withTimeout } from './retry';

/** QNB (e-Fatura) çağrısı için süre sınırı; yanıt gelmezse KDV fişlerle hesaplanır */
export const QNB_TIMEOUT_MS = 40_000;
/** Fiş sorgusu için süre sınırı */
export const FIS_TIMEOUT_MS = 30_000;

export interface KdvVerileri<F, R> {
  gelen: F[];
  giden: F[];
  fisler: R[];
  /** e-Fatura bilgileri alınamadıysa nedeni (KDV yalnızca fişlerle hesaplanmıştır) */
  qnbHatasi: unknown | null;
}

/**
 * KDV ekranı verilerini paralel getirir. Fişler zorunludur (alınamazsa hata fırlatılır);
 * QNB yavaşlar ya da hata verirse e-Fatura listeleri boş döner ve qnbHatasi doldurulur,
 * böylece ekran sonsuza dek beklemez.
 */
export async function kdvVerileriniGetir<F, R>(kaynak: {
  gelen: () => Promise<{ faturalar: F[] }>;
  giden: () => Promise<{ faturalar: F[] }>;
  fisler: () => Promise<R[]>;
  qnbMs?: number;
  fisMs?: number;
}): Promise<KdvVerileri<F, R>> {
  const qnbMs = kaynak.qnbMs ?? QNB_TIMEOUT_MS;
  const [gelen, giden, fisler] = await Promise.allSettled([
    withTimeout(kaynak.gelen(), qnbMs, 'QNB (gelen e-Faturalar)'),
    withTimeout(kaynak.giden(), qnbMs, 'QNB (giden e-Faturalar)'),
    withTimeout(kaynak.fisler(), kaynak.fisMs ?? FIS_TIMEOUT_MS, 'Fiş sorgusu'),
  ]);
  if (fisler.status === 'rejected') throw fisler.reason;
  const qnbHatasi = gelen.status === 'rejected' ? gelen.reason : giden.status === 'rejected' ? giden.reason : null;
  return {
    gelen: gelen.status === 'fulfilled' ? gelen.value.faturalar : [],
    giden: giden.status === 'fulfilled' ? giden.value.faturalar : [],
    fisler: fisler.value,
    qnbHatasi,
  };
}
