import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { currentMonthRange } from '../lib/format';
import { getSummary, type MonthlySummary } from '../services/supabase/receiptsRepository';

export function useMonthlySummary() {
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const range = currentMonthRange();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = currentMonthRange();
      setSummary(await getSummary(from, to));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ekran her odaklandığında (ör. yeni fiş kaydedip dönünce) yenile
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { summary, loading, error, refresh, monthLabel: range.label };
}
