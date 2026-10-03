import { errorMessage } from '../lib/errors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { readCache, writeCache } from '../lib/offlineCache';
import { useAuth } from './useAuth';
import { type Period, periodLabel, periodRange, stepPeriod, switchMode } from '../lib/period';
import type { MonthPoint } from '../lib/trend';
import { deleteReceipt, getCategoryTotals, getMonthlyTotals, getSummary, type PeriodSummary } from '../services/supabase/receiptsRepository';
import type { Kategori, ReceiptRecord } from '../types/receipt';

export type { Period } from '../lib/period';

type CategoryTotals = { kategori: Kategori; toplam: number }[];

export function useMonthlySummary() {
  const [period, setPeriod] = useState<Period>({ mode: 'month', offset: 0 });
  /** Özet, ait olduğu dönemin anahtarıyla saklanır; dönem değişince eski dönemin verisi gösterilmez */
  const [data, setData] = useState<{ key: string; summary: PeriodSummary; previous: CategoryTotals | null } | null>(null);
  const [trend, setTrend] = useState<MonthPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** İnternet yokken önbellekten gösteriliyorsa verinin kaydedildiği an */
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  /** Her yenilemenin sırası: hızlı dönem değişiminde geç dönen eski istek yeni veriyi ezmesin */
  const latest = useRef(0);
  // Önbellek kullanıcıya bağlı: aynı cihazda başka hesap açılırsa öncekinin verisi görünmesin
  const owner = useAuth().session?.user.id ?? '';
  const currentKey = JSON.stringify(period);

  const refresh = useCallback(async () => {
    const req = ++latest.current;
    const isLatest = () => req === latest.current;
    setLoading(true);
    setError(null);
    const key = JSON.stringify(period);
    const cacheKey = `${owner}|${key}`;
    const cached = owner ? await readCache<{ summary: PeriodSummary; trend: MonthPoint[] | null; previous?: CategoryTotals | null }>(period.mode, cacheKey) : null;
    if (!isLatest()) return;
    // Önce cihazdaki son veriyi göster (anında açılış, çevrimdışı kullanım); ağdan gelen veri üzerine yazar
    if (cached) {
      setData((d) => (d?.key === key ? d : { key, summary: cached.value.summary, previous: cached.value.previous ?? null }));
      if (cached.value.trend) setTrend(cached.value.trend);
    }
    try {
      const [s, t, previous] = await Promise.all([
        getSummary(periodRange(period)),
        // Grafik ve içgörü kritik değil: alınamazsa özet yine gösterilsin
        getMonthlyTotals(12).catch(() => null),
        period.mode === 'month' ? getCategoryTotals(periodRange({ mode: 'month', offset: period.offset - 1 })!).catch(() => null) : Promise.resolve(null),
      ]);
      if (!isLatest()) return;
      setData({ key, summary: s, previous });
      if (t) setTrend(t);
      setOfflineSince(null);
      if (owner) writeCache(period.mode, cacheKey, { summary: s, trend: t, previous });
    } catch (e) {
      if (!isLatest()) return;
      setError(errorMessage(e));
      setOfflineSince(cached ? cached.savedAt : null);
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [period, owner]);

  // Ekran her odaklandığında (ör. yeni fiş kaydedip dönünce) ve dönem değişince yenile
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const remove = useCallback(
    async (receipt: ReceiptRecord) => {
      await deleteReceipt(receipt);
      await refresh();
    },
    [refresh],
  );

  return {
    summary: data?.key === currentKey ? data.summary : null,
    /** Aylık görünümde önceki ayın kategori toplamları (içgörüler için) */
    previousCategories: data?.key === currentKey ? data.previous : null,
    trend,
    loading,
    error,
    offlineSince,
    refresh,
    remove,
    period,
    label: periodLabel(period),
    showMonthly: () => setPeriod((p) => switchMode(p, 'month')),
    showYearly: () => setPeriod((p) => switchMode(p, 'year')),
    showAll: () => setPeriod((p) => switchMode(p, 'all')),
    goToMonth: (o: number) => setPeriod({ mode: 'month', offset: Math.min(0, o) }),
    prev: () => setPeriod((p) => stepPeriod(p, -1)),
    next: () => setPeriod((p) => stepPeriod(p, 1)),
  };
}
