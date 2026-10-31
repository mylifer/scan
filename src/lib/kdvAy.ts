import type { EFatura } from '../../supabase/functions/qnb-efatura/soap';
import type { ReceiptRecord } from '../types/receipt';

/** Başka bir aydan devreden KDV kalemi */
export interface DevredenKdvKalemi {
  /** YYYY-MM biçiminde fişin kaynak ayı */
  ay: string;
  /** Ay adı (ör. 'Ocak' veya yıl farklıysa 'Ocak 2025') */
  ayAdi: string;
  /** Kullanıcıya gösterilecek satır etiketi (ör. 'Ocak Devreden KDV') */
  etiket: string;
  /** İndirilecek devreden KDV tutarı (TRY) */
  kdv: number;
  /** Bu aydan devreden fiş adedi */
  adet: number;
}

/** Bir ayın KDV hesabı (TRY) */
export interface KdvAy {
  /** Giden satış faturalarında yazan KDV ve tevkifat */
  kestigim: { faturada: number; tevkifat: number; beyan: number; adet: number };
  /** Kestiğim iade faturalarının KDV'si: iade ettiğim alışların daha önce indirilen KDV'si, düşülebilirden çıkar */
  iade: { kdv: number; adet: number };
  /** Gelen e-Faturalarda ödenen KDV; eksik: KDV bilgisi gelmeyen fatura sayısı */
  gelenEfatura: { kdv: number; adet: number; eksik: number };
  /** Taranan fişler; eslesen: bir gelen e-Faturayla aynı alışveriş olduğu için sayılmayan fişler */
  fis: {
    kdv: number;
    adet: number;
    eslesen: number;
    /** Yalnızca bu ayın tarihli fişlerinin KDV toplamı */
    buAyKdv?: number;
    /** Bu ayın tarihli fiş adedi */
    buAyAdet?: number;
    /** Önceki aylardan devreden fiş KDV'lerinin aya göre dökümü */
    devredenler?: DevredenKdvKalemi[];
    /** Önceki aylardan devreden toplam KDV tutarı */
    devredenKdv?: number;
    /** Önceki aylardan devreden toplam fiş adedi */
    devredenAdet?: number;
  };
  /** gelenEfatura.kdv + fis.kdv − iade.kdv */
  dusulebilir: number;
  /** kestigim.beyan − dusulebilir; pozitif: ödenecek, negatif: sonraki aya devreden */
  sonuc: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const AY_ISIMLERI = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

/**
 * Türkiye saat dilimine (Europe/Istanbul) göre mevcut ay (YYYY-MM).
 */
export function simdikiIstanbulAyi(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
    }).format(now);
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}

/**
 * Devreden KDV satırı için etiket üretir (ör. 'Ocak Devreden KDV' veya 'Aralık 2025 Devreden KDV').
 */
export function devredenEtiketi(ay: string, hedefAy?: string): string {
  const mIndex = Number(ay.slice(5, 7)) - 1;
  const ayAdi = AY_ISIMLERI[mIndex] ?? ay;
  const ayniYil = hedefAy ? ay.slice(0, 4) === hedefAy.slice(0, 4) : true;
  return ayniYil ? `${ayAdi} Devreden KDV` : `${ayAdi} ${ay.slice(0, 4)} Devreden KDV`;
}

/** Fiş ile gelen e-Fatura aynı alışveriş mi: aynı gün, tutar ±5 kuruş, iki tarafta da VKN varsa aynı VKN */
function ayniAlisveris(fis: ReceiptRecord, f: EFatura): boolean {
  if (fis.tarih !== f.tarih) return false;
  if (Math.abs(fis.toplam_tutar - f.tutar) > 0.05) return false;
  const v1 = (fis.vkn ?? '').trim();
  const v2 = (f.vkn ?? '').trim();
  return !v1 || !v2 || v1 === v2;
}

/**
 * Bir fişin muhasebeciye gönderildiği ay (YYYY-MM) veya gönderilmediyse kendi fiş tarihi (YYYY-MM).
 */
export function fisKdvAyi(fis: Pick<ReceiptRecord, 'tarih' | 'muhasebe_gonderildi_at'>): string {
  if (fis.muhasebe_gonderildi_at) {
    try {
      const d = new Date(fis.muhasebe_gonderildi_at);
      if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' }).format(d);
      }
    } catch {}
    return String(fis.muhasebe_gonderildi_at).slice(0, 7);
  }
  return fis.tarih ? String(fis.tarih).slice(0, 7) : '';
}

/**
 * Bir fişin hedef ayın (hedefAy: YYYY-MM) KDV indirimine dahil edilip edilmeyeceği.
 *
 * Kurallar:
 * 1) Fiş muhasebeciye gönderildiyse: Yalnızca işaretlendiği ayın (muhasebe_gonderildi_at)
 *    KDV hesabına katılır.
 * 2) Fiş muhasebeciye henüz gönderilmediyse:
 *    - Hedef ay mevcut aysa (hedefAy === simdikiAy): Bu ayın ve geçmiş ayların gönderilmemiş
 *      tüm fişleri mevcut aya devreder ve burada düşürülür (tarih <= simdikiAy).
 *    - Hedef ay geçmiş bir aysa (hedefAy < simdikiAy): Gönderilmeyen fişler mevcut aya devretmiş
 *      olduğundan geçmiş ayda düşülebilir olarak görünmez.
 *    - Hedef ay gelecek bir aysa (hedefAy > simdikiAy): Fişin kendi tarihi hedef aya eşitse dahil edilir.
 */
export function fisAyaAitMi(
  fis: Pick<ReceiptRecord, 'tarih' | 'muhasebe_gonderildi_at'>,
  hedefAy: string,
  simdikiAy: string = simdikiIstanbulAyi()
): boolean {
  if (fis.muhasebe_gonderildi_at) {
    return fisKdvAyi(fis) === hedefAy;
  }
  const fisAy = (fis.tarih || '').slice(0, 7);
  if (!fisAy) return false;

  if (hedefAy === simdikiAy) {
    return fisAy <= simdikiAy;
  } else if (hedefAy < simdikiAy) {
    return false;
  } else {
    return fisAy === hedefAy;
  }
}

/**
 * Ayın KDV'si. Giden: iptal, taslak ve hariç tutulan (olağan dışı) faturalar sayılmaz.
 * Düşülebilir: gelen e-Fatura KDV'si + e-Faturayla eşleşmeyen fişlerin KDV'si − kestiğim iade faturalarının KDV'si
 * (alışı iade edince o alışın KDV'si artık indirilemez). Yalnızca TRY.
 *
 * Muhasebeciye gönderilmiş fişler yalnızca gönderildikleri ayın (muhasebe_gonderildi_at) KDV hesabına katılır.
 * Muhasebeciye henüz gönderilmemiş fişler ise mevcut bulunulan ayda (simdikiAy) düşürülür;
 * önceki aylardan devreden fişler `fis.devredenler` altında aya göre ayrı kalemler halinde listelenir.
 */
export function kdvAyHesapla(
  gelen: EFatura[],
  giden: EFatura[],
  fisler: ReceiptRecord[],
  haric: ReadonlySet<string> = new Set(),
  hedefAy?: string,
  simdikiAy?: string
): KdvAy {
  const gecerli = (f: EFatura) => !f.iptal && !f.taslak && f.paraBirimi === 'TRY' && !haric.has(f.ettn.toLowerCase());

  const satis = giden.filter((f) => gecerli(f) && f.tip !== 'IADE');
  const iadeler = giden.filter((f) => gecerli(f) && f.tip === 'IADE');
  const faturada = r2(satis.reduce((t, f) => t + (f.kdv ?? 0), 0));
  const tevkifat = r2(satis.reduce((t, f) => t + (f.tevkifat ?? 0), 0));

  const gelenGecerli = gelen.filter(gecerli);
  const gelenKdv = r2(gelenGecerli.reduce((t, f) => t + (f.kdv ?? 0), 0));

  const ay = hedefAy || gelenGecerli[0]?.tarih?.slice(0, 7) || satis[0]?.tarih?.slice(0, 7) || iadeler[0]?.tarih?.slice(0, 7);
  const nowMonth = simdikiAy ?? (hedefAy ? simdikiIstanbulAyi() : (ay || simdikiIstanbulAyi()));
  const gecerliFisler = ay ? fisler.filter((f) => fisAyaAitMi(f, ay, nowMonth)) : fisler;

  const kullanildi = new Set<EFatura>();
  let eslesen = 0;
  let buAyKdv = 0;
  let buAyAdet = 0;
  const devredenMap = new Map<string, { kdv: number; adet: number }>();

  for (const fis of gecerliFisler) {
    const es = gelenGecerli.find((f) => !kullanildi.has(f) && ayniAlisveris(fis, f));
    if (es) {
      kullanildi.add(es);
      eslesen += 1;
      continue;
    }
    const fisAy = (fis.tarih || '').slice(0, 7);
    const kdv = fis.toplam_kdv ?? 0;
    if (ay && fisAy && fisAy < ay) {
      const prev = devredenMap.get(fisAy) || { kdv: 0, adet: 0 };
      devredenMap.set(fisAy, { kdv: r2(prev.kdv + kdv), adet: prev.adet + 1 });
    } else {
      buAyKdv += kdv;
      buAyAdet += 1;
    }
  }

  const devredenler: DevredenKdvKalemi[] = [...devredenMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mAy, val]) => {
      const etiket = devredenEtiketi(mAy, ay);
      const mIdx = Number(mAy.slice(5, 7)) - 1;
      const ayAdi = ay && mAy.slice(0, 4) === ay.slice(0, 4)
        ? AY_ISIMLERI[mIdx] ?? mAy
        : `${AY_ISIMLERI[mIdx] ?? mAy} ${mAy.slice(0, 4)}`;
      return {
        ay: mAy,
        ayAdi,
        etiket,
        kdv: r2(val.kdv),
        adet: val.adet,
      };
    });

  const devredenKdv = r2(devredenler.reduce((acc, d) => acc + d.kdv, 0));
  const devredenAdet = devredenler.reduce((acc, d) => acc + d.adet, 0);
  buAyKdv = r2(buAyKdv);
  const fisKdv = r2(buAyKdv + devredenKdv);
  const fisAdet = buAyAdet + devredenAdet;

  const iadeKdv = r2(iadeler.reduce((t, f) => t + (f.kdv ?? 0), 0));
  const beyan = r2(faturada - tevkifat);
  const dusulebilir = r2(gelenKdv + fisKdv - iadeKdv);
  return {
    kestigim: { faturada, tevkifat, beyan, adet: satis.length },
    iade: { kdv: iadeKdv, adet: iadeler.length },
    gelenEfatura: { kdv: gelenKdv, adet: gelenGecerli.length, eksik: gelenGecerli.filter((f) => typeof f.kdv !== 'number').length },
    fis: {
      kdv: fisKdv,
      adet: fisAdet,
      eslesen,
      ...(devredenler.length > 0
        ? {
            buAyKdv,
            buAyAdet,
            devredenler,
            devredenKdv,
            devredenAdet,
          }
        : {}),
    },
    dusulebilir,
    sonuc: r2(beyan - dusulebilir),
  };
}
