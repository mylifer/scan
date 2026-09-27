import { errorMessage } from '../lib/errors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { type Period, periodLabel, periodRange, stepPeriod, switchMode } from '../lib/period';
import type { MonthPoint } from '../lib/trend';
import { deleteReceipt, getMonthlyTotals, getSummary, type PeriodSummary } from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';

export type { Period } from '../lib/period';

export function useMonthlySummary() {
  const [period, setPeriod] = useState<Period>({ mode: 'month', offset: 0 });
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [trend, setTrend] = useState<MonthPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, t] = await Promise.all([
        getSummary(periodRange(period)),
        // Grafik kritik değil: alınamazsa özet yine gösterilsin
        getMonthlyTotals(12).catch(() => null),
      ]);
      setSummary(s);
      if (t) setTrend(t);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
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
    summary,
    trend,
    loading,
    error,
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
