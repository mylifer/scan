import { withTimeout } from './retry';

/**
 * QNB (e-Fatura) çağrısı için süre sınırı. Ekran bu sırada fişleri ve kayıtlı e-Fatura sonucunu gösterdiği
 * için bekleme kullanıcıyı engellemez; sunucu fonksiyonunun kendi sınırına (150 sn) yakın tutulur.
 */
export const QNB_TIMEOUT_MS = 120_000;
/** Fiş sorgusu için süre sınırı */
export const FIS_TIMEOUT_MS = 30_000;

export interface KdvVerileri<F, R> {
  gelen: F[];
  giden: F[];
  fisler: R[];
  /** Gelen / giden listeleri QNB'den alınabildi mi (alınamadıysa liste boştur) */
  gelenOk: boolean;
  gidenOk: boolean;
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
    gelenOk: gelen.status === 'fulfilled',
    gidenOk: giden.status === 'fulfilled',
    qnbHatasi,
  };
}

/** Önceki ayların gelen e-Faturaları; eksikAylar: ne QNB'den ne de önbellekten alınabilen aylar */
export interface OncekiGelen<F> {
  faturalar: F[];
  eksikAylar: string[];
}

/**
 * Devreden fişlerin aylarının gelen e-Faturalarını getirir (bkz. devredenFisAylari). QNB'ye aynı anda en fazla
 * `eszamanli` istek gider; bir ay alınamazsa (süre aşımı, hata) kayıtlı sonuç kullanılır, o da yoksa ay eksik sayılır.
 * Hiçbir zaman hata fırlatmaz: eşleştirme yapılamazsa fişler eskisi gibi sayılır.
 */
export async function oncekiGelenleriGetir<F>(
  aylar: string[],
  kaynak: {
    getir: (ay: string) => Promise<{ faturalar: F[] }>;
    kayitli: (ay: string) => Promise<F[] | null> | F[] | null;
    qnbMs?: number;
    eszamanli?: number;
  },
): Promise<OncekiGelen<F>> {
  const qnbMs = kaynak.qnbMs ?? QNB_TIMEOUT_MS;
  const limit = Math.max(1, kaynak.eszamanli ?? 3);
  const faturalar: F[] = [];
  const eksikAylar: string[] = [];
  for (let i = 0; i < aylar.length; i += limit) {
    const parca = aylar.slice(i, i + limit);
    const sonuclar = await Promise.all(
      parca.map(async (ay) => {
        try {
          return (await withTimeout(kaynak.getir(ay), qnbMs, `QNB (${ay} gelen e-Faturalar)`)).faturalar;
        } catch {
          try {
            return await kaynak.kayitli(ay);
          } catch {
            return null;
          }
        }
      }),
    );
    sonuclar.forEach((s, j) => {
      if (s) faturalar.push(...s);
      else eksikAylar.push(parca[j]!);
    });
  }
  return { faturalar, eksikAylar };
}
