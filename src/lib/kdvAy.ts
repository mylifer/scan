import type { EFatura } from '../../supabase/functions/qnb-efatura/soap';
import type { ReceiptRecord } from '../types/receipt';

/** Bir ayın KDV hesabı (TRY) */
export interface KdvAy {
  /** Giden satış faturalarında yazan KDV ve tevkifat */
  kestigim: { faturada: number; tevkifat: number; beyan: number; adet: number };
  /** Giden iade faturalarının KDV'si (ayrı gösterilir; hesaba katılmaz) */
  iade: { kdv: number; adet: number };
  /** Gelen e-Faturalarda ödenen KDV; eksik: KDV bilgisi gelmeyen fatura sayısı */
  gelenEfatura: { kdv: number; adet: number; eksik: number };
  /** Taranan fişler; eslesen: bir gelen e-Faturayla aynı alışveriş olduğu için sayılmayan fişler */
  fis: { kdv: number; adet: number; eslesen: number };
  /** gelenEfatura.kdv + fis.kdv */
  dusulebilir: number;
  /** kestigim.beyan − dusulebilir; pozitif: ödenecek, negatif: sonraki aya devreden */
  sonuc: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Fiş ile gelen e-Fatura aynı alışveriş mi: aynı gün, tutar ±5 kuruş, iki tarafta da VKN varsa aynı VKN */
function ayniAlisveris(fis: ReceiptRecord, f: EFatura): boolean {
  if (fis.tarih !== f.tarih) return false;
  if (Math.abs(fis.toplam_tutar - f.tutar) > 0.05) return false;
  const v1 = (fis.vkn ?? '').trim();
  const v2 = (f.vkn ?? '').trim();
  return !v1 || !v2 || v1 === v2;
}

/**
 * Ayın KDV'si. Giden: iptal, taslak ve hariç tutulan (olağan dışı) faturalar sayılmaz; iade faturaları ayrı.
 * Gelen: e-Fatura KDV'si + e-Faturayla eşleşmeyen fişlerin KDV'si. Yalnızca TRY.
 */
export function kdvAyHesapla(gelen: EFatura[], giden: EFatura[], fisler: ReceiptRecord[], haric: ReadonlySet<string> = new Set()): KdvAy {
  const gecerli = (f: EFatura) => !f.iptal && !f.taslak && f.paraBirimi === 'TRY' && !haric.has(f.ettn.toLowerCase());

  const satis = giden.filter((f) => gecerli(f) && f.tip !== 'IADE');
  const iadeler = giden.filter((f) => gecerli(f) && f.tip === 'IADE');
  const faturada = r2(satis.reduce((t, f) => t + (f.kdv ?? 0), 0));
  const tevkifat = r2(satis.reduce((t, f) => t + (f.tevkifat ?? 0), 0));

  const gelenGecerli = gelen.filter(gecerli);
  const gelenKdv = r2(gelenGecerli.reduce((t, f) => t + (f.kdv ?? 0), 0));

  const kullanildi = new Set<EFatura>();
  let eslesen = 0;
  let fisKdv = 0;
  let fisAdet = 0;
  for (const fis of fisler) {
    const es = gelenGecerli.find((f) => !kullanildi.has(f) && ayniAlisveris(fis, f));
    if (es) {
      kullanildi.add(es);
      eslesen += 1;
      continue;
    }
    fisKdv += fis.toplam_kdv ?? 0;
    fisAdet += 1;
  }
  fisKdv = r2(fisKdv);

  const beyan = r2(faturada - tevkifat);
  const dusulebilir = r2(gelenKdv + fisKdv);
  return {
    kestigim: { faturada, tevkifat, beyan, adet: satis.length },
    iade: { kdv: r2(iadeler.reduce((t, f) => t + (f.kdv ?? 0), 0)), adet: iadeler.length },
    gelenEfatura: { kdv: gelenKdv, adet: gelenGecerli.length, eksik: gelenGecerli.filter((f) => typeof f.kdv !== 'number').length },
    fis: { kdv: fisKdv, adet: fisAdet, eslesen },
    dusulebilir,
    sonuc: r2(beyan - dusulebilir),
  };
}
