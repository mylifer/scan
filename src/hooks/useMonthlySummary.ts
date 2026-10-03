import { errorMessage } from '../lib/errors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { readCache, writeCache } from '../lib/offlineCache';
import { type Period, periodLabel, periodRange, stepPeriod, switchMode } from '../lib/period';
import type { MonthPoint } from '../lib/trend';
import { deleteReceipt, getMonthlyTotals, getSummary, type PeriodSummary } from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';

export type { Period } from '../lib/period';

export function useMonthlySummary() {
  const [period, setPeriod] = useState<Period>({ mode: 'month', offset: 0 });
  /** Özet, ait olduğu dönemin anahtarıyla saklanır; dönem değişince eski dönemin verisi gösterilmez */
  const [data, setData] = useState<{ key: string; summary: PeriodSummary } | null>(null);
  const [trend, setTrend] = useState<MonthPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** İnternet yokken önbellekten gösteriliyorsa verinin kaydedildiği an */
  const [offlineSince, setOfflineSince] = useState<number | null>(null);
  /** Her yenilemenin sırası: hızlı dönem değişiminde geç dönen eski istek yeni veriyi ezmesin */
  const latest = useRef(0);
  const currentKey = JSON.stringify(period);

  const refresh = useCallback(async () => {
    const req = ++latest.current;
    const isLatest = () => req === latest.current;
    setLoading(true);
    setError(null);
    const key = JSON.stringify(period);
    const cached = await readCache<{ summary: PeriodSummary; trend: MonthPoint[] | null }>(period.mode, key);
    if (!isLatest()) return;
    // Önce cihazdaki son veriyi göster (anında açılış, çevrimdışı kullanım); ağdan gelen veri üzerine yazar
    if (cached) {
      setData((d) => (d?.key === key ? d : { key, summary: cached.value.summary }));
      if (cached.value.trend) setTrend(cached.value.trend);
    }
    try {
      const [s, t] = await Promise.all([
        getSummary(periodRange(period)),
        // Grafik kritik değil: alınamazsa özet yine gösterilsin
        getMonthlyTotals(12).catch(() => null),
      ]);
      if (!isLatest()) return;
      setData({ key, summary: s });
      if (t) setTrend(t);
      setOfflineSince(null);
      writeCache(period.mode, key, { summary: s, trend: t });
    } catch (e) {
      if (!isLatest()) return;
      setError(errorMessage(e));
      setOfflineSince(cached ? cached.savedAt : null);
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [period]);

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
