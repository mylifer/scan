import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { monthRange } from '../lib/format';
import {
  getRecentReceipts,
  getSummary,
  type MonthlySummary,
} from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';

/** offset 0 = bu ay, -1 = geçen ay, ... */
export function useMonthlySummary() {
  const [offset, setOffset] = useState(0);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [recent, setRecent] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = monthRange(offset);
      const [s, r] = await Promise.all([getSummary(from, to), getRecentReceipts(5)]);
      setSummary(s);
      setRecent(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [offset]);

  // Ekran her odaklandığında (ör. yeni fiş kaydedip dönünce) ve ay değişince yenile
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return {
    summary,
    recent,
    loading,
    error,
    refresh,
    offset,
    monthLabel: monthRange(offset).label,
    prevMonth: () => setOffset((o) => o - 1),
    nextMonth: () => setOffset((o) => Math.min(0, o + 1)),
  };
}
