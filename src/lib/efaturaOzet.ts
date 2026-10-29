import type { EFatura, TutarSatiri } from '../../supabase/functions/qnb-efatura/soap';

/** Bir grup faturanın toplamları */
export interface Toplam {
  adet: number;
  matrah: number;
  kdv: number;
  tevkifat: number;
  /** Ödenecek (KDV dahil) */
  tutar: number;
  /** KDV oranına göre: { "20": 24000 } */
  oranlar: Record<string, number>;
}

export interface DonemOzet {
  /** YYYY ya da YYYY-MM; genel toplamda 'tum' */
  donem: string;
  /** Gelen e-Faturalar (alış): indirilecek KDV */
  gelen: Toplam;
  /** Giden satış faturaları (ve tevkifatlı satış): hesaplanan KDV */
  satis: Toplam;
  /** Giden iade faturaları */
  iade: Toplam;
  /** Giden e-Arşiv faturaları (iptaller hariç) */
  earsiv: Toplam;
}

export interface OlaganDisi {
  ettn: string;
  tarih: string;
  belgeNo: string;
  matrah: number;
  kdv: number;
  /** Aynı yöndeki faturaların ortanca matrahının kaç katı */
  kat: number;
}

const bos = (): Toplam => ({ adet: 0, matrah: 0, kdv: 0, tevkifat: 0, tutar: 0, oranlar: {} });
const yuvarla = (n: number) => Math.round(n * 100) / 100;

function ekle(t: Toplam, r: { matrah: number; kdv: number; tevkifat?: number; tutar: number; oranlar?: Record<string, number> }) {
  t.adet += 1;
  t.matrah = yuvarla(t.matrah + r.matrah);
  t.kdv = yuvarla(t.kdv + r.kdv);
  t.tevkifat = yuvarla(t.tevkifat + (r.tevkifat ?? 0));
  t.tutar = yuvarla(t.tutar + r.tutar);
  for (const [o, v] of Object.entries(r.oranlar ?? {})) t.oranlar[o] = yuvarla((t.oranlar[o] ?? 0) + v);
}

function bosDonem(donem: string): DonemOzet {
  return { donem, gelen: bos(), satis: bos(), iade: bos(), earsiv: bos() };
}

/** Aynı ETTN birden çok kez gelirse (ay sınırı, yeniden sorgu) bir kez sayılır */
function tekil<T extends { ettn: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = x.ettn.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Genel, yıllık ve aylık özet. Gelen KDV = indirilecek, giden satış KDV = hesaplanan; iade faturaları ayrı
 * tutulur (beyannamede nasıl gösterileceği muhasebe tercihine bağlı). Yalnızca TRY tutarlar toplanır.
 * haric: toplamlara katılmayacak giden faturaların ETTN'leri (küçük harf).
 */
export function ozetle(gelen: TutarSatiri[], giden: TutarSatiri[], earsiv: EFatura[], haric: ReadonlySet<string> = new Set()) {
  const genel = bosDonem('tum');
  const yillar = new Map<string, DonemOzet>();
  const aylar = new Map<string, DonemOzet>();
  const al = (map: Map<string, DonemOzet>, k: string) => map.get(k) ?? (map.set(k, bosDonem(k)), map.get(k)!);
  const isle = (tarih: string, alan: keyof Omit<DonemOzet, 'donem'>, r: Parameters<typeof ekle>[1]) => {
    for (const d of [genel, al(yillar, tarih.slice(0, 4) || '?'), al(aylar, tarih.slice(0, 7) || '?')]) ekle(d[alan], r);
  };
  for (const r of tekil(gelen)) if (r.paraBirimi === 'TRY') isle(r.tarih, 'gelen', { ...r, tutar: r.odenecek });
  for (const r of tekil(giden)) if (r.paraBirimi === 'TRY' && !haric.has(r.ettn.toLowerCase())) isle(r.tarih, r.tip === 'IADE' ? 'iade' : 'satis', { ...r, tutar: r.odenecek });
  for (const f of tekil(earsiv))
    if (!f.iptal && !f.taslak && f.paraBirimi === 'TRY') isle(f.tarih, 'earsiv', { matrah: f.matrah ?? 0, kdv: f.kdv ?? 0, tutar: f.tutar });
  const sirala = (m: Map<string, DonemOzet>) => [...m.values()].sort((a, b) => b.donem.localeCompare(a.donem));
  return { genel, yillar: sirala(yillar), aylar: sirala(aylar) };
}

/** Hesaplanan − indirilecek (iadeler hariç; pozitif: ödenecek yönde) */
export function kdvFarki(d: DonemOzet): number {
  return yuvarla(d.satis.kdv + d.earsiv.kdv - d.gelen.kdv);
}

/** Ortancanın `esik` katından büyük matrahlı giden faturalar (yanlış tutarla kesilmiş olabilir) */
export function olaganDisi(giden: TutarSatiri[], esik = 20): OlaganDisi[] {
  const m = giden.map((r) => r.matrah).filter((x) => x > 0).sort((a, b) => a - b);
  if (m.length < 3) return [];
  const ortanca = m[Math.floor(m.length / 2)]!;
  return giden
    .filter((r) => ortanca > 0 && r.matrah / ortanca >= esik)
    .map((r) => ({ ettn: r.ettn, tarih: r.tarih, belgeNo: r.belgeNo, matrah: r.matrah, kdv: r.kdv, kat: Math.round(r.matrah / ortanca) }));
}

/** "2026-10" → ayın ilk ve son günü */
export function ayAraligi(ay: string): { from: string; to: string } {
  const [y, m] = ay.split('-').map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return { from: `${ay}-01`, to: `${ay}-${String(last).padStart(2, '0')}` };
}

/** ilk ay (YYYY-MM) ile bu ay arasındaki aylar, eskiden yeniye */
export function aylarArasi(ilk: string, simdi = new Date()): string[] {
  const out: string[] = [];
  let [y, m] = ilk.split('-').map(Number) as [number, number];
  const sonY = simdi.getFullYear();
  const sonM = simdi.getMonth() + 1;
  while (y < sonY || (y === sonY && m <= sonM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Toplamlardan hariç tutulan faturaların ETTN'leri (küçük harf); özet ekranı yazar, aylık liste okur */
export const HARIC_KEY = 'efatura-ozet:haric';
/** Olağan dışı faturaları yine de toplamlara katma tercihi ("1" ise katılır) */
export const OLAGANDISI_DAHIL_KEY = 'efatura-ozet:olagandisi-dahil';
