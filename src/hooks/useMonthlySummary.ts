import { errorMessage } from '../lib/errors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { monthRange } from '../lib/format';
import type { MonthPoint } from '../lib/trend';
import { deleteReceipt, getMonthlyTotals, getSummary, type PeriodSummary } from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';

/** Aylık görünümde offset 0 = bu ay, -1 = geçen ay; ya da tüm zamanlar. */
export type Period = { mode: 'month'; offset: number } | { mode: 'all' };

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
        getSummary(period.mode === 'month' ? monthRange(period.offset) : undefined),
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

  const offset = period.mode === 'month' ? period.offset : 0;
  return {
    summary,
    trend,
    loading,
    error,
    refresh,
    remove,
    period,
    label: period.mode === 'month' ? monthRange(period.offset).label : 'Tüm zamanlar',
    showMonthly: () => setPeriod({ mode: 'month', offset }),
    showAll: () => setPeriod({ mode: 'all' }),
    goToMonth: (o: number) => setPeriod({ mode: 'month', offset: Math.min(0, o) }),
    prevMonth: () => setPeriod({ mode: 'month', offset: offset - 1 }),
    nextMonth: () => setPeriod({ mode: 'month', offset: Math.min(0, offset + 1) }),
  };
}
