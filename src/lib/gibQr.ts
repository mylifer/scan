import { normalizeTrDate, round2 } from './format';
import { cleanFisNo, cleanTaxId } from './receiptExtras';

/**
 * GİB e-Fatura / e-Arşiv fatura karekodu: faturanın üzerindeki JSON, ör.
 * {"vkntckn":"1234567890","avkntckn":"...","senaryo":"EARSIVFATURA","tip":"SATIS","tarih":"2026-09-14",
 *  "no":"ABC2026000000123","ettn":"...","parabirimi":"TRY","malhizmettoplam":"100","kdvmatrah(20)":"100",
 *  "hesaplanankdv(20)":"20","vergidahil":"120","odenecek":"120"}
 * Fotoğraftan okumanın aksine değerler kesindir; yalnızca satıcının adı karekodda yoktur.
 */
export interface GibQrData {
  /** Satıcının VKN (10) ya da TCKN (11) */
  vkn: string;
  /** Fatura numarası */
  faturaNo: string;
  /** GG.AA.YYYY */
  tarih: string;
  toplamTutar: number;
  kdvYuzde1: number;
  kdvYuzde10: number;
  kdvYuzde20: number;
  /** Para birimi TRY değilse (tutarlar o para biriminde) */
  paraBirimi: string;
  /** "EARSIVFATURA", "TEMELFATURA" … */
  senaryo: string;
}

/** Karekod metnini çözer; GİB fatura karekodu değilse null */
export function parseGibQr(text: string): GibQrData | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  // Anahtarlar küçük harfe ve boşluksuz hâle getirilir ("KdvMatrah (20)" → "kdvmatrah(20)")
  const obj = new Map<string, unknown>();
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) obj.set(k.toLocaleLowerCase('tr-TR').replace(/\s+/g, ''), v);
  const str = (k: string) => {
    const v = obj.get(k);
    return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '';
  };
  const amount = (k: string) => qrNumber(str(k));

  const vkn = cleanTaxId(str('vkntckn'));
  const tarih = normalizeQrDate(str('tarih'));
  const total = obj.has('odenecek') ? amount('odenecek') : amount('vergidahil');
  if ((vkn.length !== 10 && vkn.length !== 11) || !tarih || !(total > 0)) return null;

  // KDV dilimleri: "hesaplanankdv(20)"; eski oranlar (8, 18) en yakın güncel dilime yazılır
  let k1 = 0;
  let k10 = 0;
  let k20 = 0;
  for (const [key] of obj) {
    const m = key.match(/^hesaplanankdv\((\d+(?:[.,]\d+)?)\)$/);
    if (!m) continue;
    const rate = Number(m[1].replace(',', '.'));
    const v = amount(key);
    if (rate <= 0 || !v) continue;
    if (rate < 5) k1 += v;
    else if (rate < 15) k10 += v;
    else k20 += v;
  }
  // Dilim yoksa ama toplam KDV varsa (ör. tek oran) %20'ye yazılır; kullanıcı formda düzeltebilir
  if (!k1 && !k10 && !k20 && obj.has('hesaplanankdv')) k20 = amount('hesaplanankdv');

  return {
    vkn,
    faturaNo: cleanFisNo(str('no')),
    tarih,
    toplamTutar: round2(total),
    kdvYuzde1: round2(k1),
    kdvYuzde10: round2(k10),
    kdvYuzde20: round2(k20),
    paraBirimi: (str('parabirimi') || 'TRY').toLocaleUpperCase('tr-TR'),
    senaryo: str('senaryo').toLocaleUpperCase('tr-TR'),
  };
}

/** Karekoddaki sayılar makine biçimindedir ("8.475" = 8,475): binlik ayırıcı yoktur; yalnızca virgüllü yazılmışsa virgül ondalıktır */
function qrNumber(value: string): number {
  const s = value.replace(/\s/g, '');
  const n = Number(s.includes('.') ? s.replace(/,/g, '') : s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/** "2026-09-14", "14.09.2026", "14/09/2026" → "14.09.2026" */
function normalizeQrDate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return normalizeTrDate(`${iso[3]}.${iso[2]}.${iso[1]}`);
  return normalizeTrDate(value.replace(/\//g, '.'));
}
