import { ozetle, type DonemOzet } from "@shared/lib/efaturaOzet";
import type { EFatura, TutarSatiri, Yon } from "@shared/services/efatura/qnbEfatura";

/** Listedeki faturayı dönem özeti satırına çevirir (KDV oranı bilinmediği için %20 varsayılır). */
export function tutarSatiri(f: EFatura): TutarSatiri {
  return {
    ettn: f.ettn,
    belgeNo: f.belgeNo,
    tarih: f.tarih,
    vkn: f.vkn,
    matrah: f.matrah ?? Math.max(0, f.tutar - (f.kdv ?? 0)),
    kdv: f.kdv ?? 0,
    tevkifat: 0,
    odenecek: f.tutar,
    paraBirimi: f.paraBirimi,
    oranlar: (f.kdv ? { "20": f.kdv } : {}) as Record<string, number>,
    tip: f.tip,
  };
}

/** Toplamlara katılan faturalar: iptal edilmiş ve gönderilmemiş taslaklar hariç */
export function gecerliFaturalar(faturalar: EFatura[]): EFatura[] {
  return faturalar.filter((f) => !f.iptal && !f.taslak);
}

/**
 * Dönem özeti. Giden yönde e-Arşiv faturaları yalnızca `earsiv` grubunda sayılır (satış toplamına
 * ikinci kez eklenmez); iptal ve taslak faturalar toplamlara katılmaz.
 */
export function donemOzetiHesapla(faturalar: EFatura[], yon: Yon): DonemOzet {
  if (yon === "gelen") return ozetle(faturalar.map(tutarSatiri), [], []).genel;
  const gecerli = gecerliFaturalar(faturalar);
  const giden = gecerli.filter((f) => f.tur !== "earsiv").map(tutarSatiri);
  const earsiv = gecerli.filter((f) => f.tur === "earsiv");
  return ozetle([], giden, earsiv).genel;
}
