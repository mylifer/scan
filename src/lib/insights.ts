import { formatTL, round2 } from './format';
import { type Kategori, KATEGORI_ETIKETLERI, type ReceiptRecord } from '../types/receipt';

/**
 * Aylık içgörü özeti: kural tabanlı, yapay zekâ kullanmaz (kota harcamaz).
 * Dönemin fişlerinden ve bir önceki ayın kategori toplamlarından kısa cümleler üretir.
 */
export type InsightKind = 'category-up' | 'category-down' | 'top-firm' | 'largest' | 'kdv' | 'pace';

export interface Insight {
  kind: InsightKind;
  text: string;
}

export interface InsightInput {
  fisler: Pick<ReceiptRecord, 'firma_adi' | 'tarih' | 'toplam_tutar' | 'toplam_kdv' | 'kategori'>[];
  toplamGider: number;
  toplamKdv: number;
  /** Önceki ayın kategori toplamları; alınamadıysa null */
  previous: { kategori: Kategori; toplam: number }[] | null;
  /** Görüntülenen ay bu aysa, bugünün günü ve aydaki gün sayısı (tahmin için) */
  current: { day: number; daysInMonth: number } | null;
}

/** Kategori değişimi bu eşiklerin ikisini de aşarsa söylenir (küçük oynamalar gürültü) */
const MIN_CHANGE_TL = 250;
const MIN_CHANGE_PCT = 25;

const pct = (n: number) => `%${Math.round(n).toLocaleString('tr-TR')}`;
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const day = (iso: string) => `${Number(iso.slice(8, 10))} ${AYLAR[Number(iso.slice(5, 7)) - 1]}`;

export function monthlyInsights({ fisler, toplamGider, toplamKdv, previous, current }: InsightInput): Insight[] {
  const out: Insight[] = [];
  if (fisler.length === 0 || toplamGider <= 0) return out;

  // 1. Önceki aya göre en çok değişen kategori (bu ay bitmeden azalış söylenmez: ay sürüyor)
  if (previous) {
    const now = new Map<Kategori, number>();
    for (const r of fisler) now.set(r.kategori, (now.get(r.kategori) ?? 0) + r.toplam_tutar);
    const prev = new Map(previous.map((p) => [p.kategori, p.toplam]));
    const changes = [...new Set([...now.keys(), ...prev.keys()])].map((k) => {
      const a = round2(now.get(k) ?? 0);
      const b = round2(prev.get(k) ?? 0);
      return { k, a, b, diff: round2(a - b) };
    });
    const up = changes
      .filter((c) => c.diff >= MIN_CHANGE_TL && (c.b === 0 || (c.diff / c.b) * 100 >= MIN_CHANGE_PCT))
      .sort((x, y) => y.diff - x.diff)[0];
    if (up) {
      const label = KATEGORI_ETIKETLERI[up.k];
      out.push({
        kind: 'category-up',
        text:
          up.b === 0
            ? `${label} harcaması geçen ay yoktu, bu ay ${formatTL(up.a)}.`
            : `${label} harcaması geçen aya göre ${formatTL(up.diff)} arttı (${pct((up.diff / up.b) * 100)}).`,
      });
    }
    if (!current) {
      const down = changes
        .filter((c) => -c.diff >= MIN_CHANGE_TL && c.b > 0 && (-c.diff / c.b) * 100 >= MIN_CHANGE_PCT)
        .sort((x, y) => x.diff - y.diff)[0];
      if (down) {
        out.push({
          kind: 'category-down',
          text: `${KATEGORI_ETIKETLERI[down.k]} harcaması geçen aya göre ${formatTL(-down.diff)} azaldı (${pct((-down.diff / down.b) * 100)}).`,
        });
      }
    }
  }

  // 2. En çok harcama yapılan firma (birden çok fişi varsa; tek fişse "en büyük fiş" zaten söyler)
  if (fisler.length >= 2) {
    const firms = new Map<string, { name: string; total: number; count: number }>();
    for (const r of fisler) {
      const key = r.firma_adi.trim().toLocaleUpperCase('tr-TR');
      const f = firms.get(key) ?? { name: r.firma_adi.trim(), total: 0, count: 0 };
      f.total += r.toplam_tutar;
      f.count += 1;
      firms.set(key, f);
    }
    const top = [...firms.values()].filter((f) => f.count >= 2).sort((a, b) => b.total - a.total || b.count - a.count)[0];
    if (top && firms.size > 1) {
      out.push({
        kind: 'top-firm',
        text: `En çok harcama: ${top.name} — ${top.count} fiş, ${formatTL(round2(top.total))} · giderlerin ${pct((top.total / toplamGider) * 100)} kadarı.`,
      });
    }
  }

  // 3. En büyük fiş
  const largest = [...fisler].sort((a, b) => b.toplam_tutar - a.toplam_tutar)[0]!;
  if (fisler.length >= 3) {
    out.push({ kind: 'largest', text: `En büyük fiş: ${largest.firma_adi.trim()}, ${formatTL(largest.toplam_tutar)} (${day(largest.tarih)}).` });
  }

  // 4. İndirilecek KDV
  if (toplamKdv > 0) {
    out.push({ kind: 'kdv', text: `Fişlerdeki KDV toplamı ${formatTL(toplamKdv)} · giderlere oranı ${pct((toplamKdv / toplamGider) * 100)}.` });
  }

  // 5. Bu ay için gidişat (ayın ilk haftası geçtiyse; erken tahmin yanıltıcı)
  if (current && current.day >= 7 && current.day < current.daysInMonth) {
    const projected = round2((toplamGider / current.day) * current.daysInMonth);
    out.push({ kind: 'pace', text: `Bu hızla ay sonunda yaklaşık ${formatTL(projected)} gider bekleniyor.` });
  }

  return out;
}
