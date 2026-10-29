import { round2 } from './format';
import type { Kategori, ReceiptRecord } from '../types/receipt';

export interface PeriodSummary {
  toplamGider: number;
  toplamKdv: number;
  kdv1: number;
  kdv10: number;
  kdv20: number;
  fisSayisi: number;
  kategoriToplamlari: { kategori: Kategori; toplam: number }[];
  /** Dönemdeki fişler; fiş tarihine, sonra eklenme zamanına göre yeniden eskiye */
  fisler: ReceiptRecord[];
}

/** Fişlerin toplamları (dönem özeti; dışa aktarımda yalnızca seçilen fişler için de kullanılır) */
export function summarizeReceipts(rows: ReceiptRecord[]): PeriodSummary {
  const byKategori = new Map<Kategori, number>();
  let toplamGider = 0;
  let kdv1 = 0;
  let kdv10 = 0;
  let kdv20 = 0;
  for (const r of rows) {
    toplamGider += r.toplam_tutar;
    kdv1 += r.kdv_yuzde1;
    kdv10 += r.kdv_yuzde10;
    kdv20 += r.kdv_yuzde20;
    byKategori.set(r.kategori, (byKategori.get(r.kategori) ?? 0) + r.toplam_tutar);
  }
  return {
    toplamGider: round2(toplamGider),
    toplamKdv: round2(kdv1 + kdv10 + kdv20),
    kdv1: round2(kdv1),
    kdv10: round2(kdv10),
    kdv20: round2(kdv20),
    fisSayisi: rows.length,
    kategoriToplamlari: [...byKategori.entries()].map(([kategori, toplam]) => ({ kategori, toplam: round2(toplam) })).sort((a, b) => b.toplam - a.toplam),
    fisler: rows,
  };
}

/** Muhasebeciye gönderildi olarak işaretli mi */
export const isSent = (r: Pick<ReceiptRecord, 'muhasebe_gonderildi_at'>) => !!r.muhasebe_gonderildi_at;
