import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { errorMessage } from '../lib/errors';
import { readCache, writeCache } from '../lib/offlineCache';
import { getSummary } from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';
import { useAuth } from './useAuth';

/**
 * Bugüne kadarki tüm fişler (Tüm Fişler, Firmalar ve Firma Detayı ekranları için).
 * Ekran her odaklandığında yenilenir; internet yokken cihazdaki son kopya gösterilir.
 */
export function useAllReceipts() {
  const owner = useAuth().session?.user.id ?? '';
  const [receipts, setReceipts] = useState<ReceiptRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const req = ++latest.current;
    setLoading(true);
    if (owner) {
      const cached = await readCache<ReceiptRecord[]>('receipts', owner);
      if (req === latest.current && cached) setReceipts((cur) => cur ?? cached.value);
    }
    try {
      const { fisler } = await getSummary();
      if (req !== latest.current) return;
      setReceipts(fisler);
      setError(null);
      if (owner) writeCache('receipts', owner, fisler);
    } catch (e) {
      if (req === latest.current) setError(errorMessage(e));
    } finally {
      if (req === latest.current) setLoading(false);
    }
  }, [owner]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { receipts, error, loading, refresh };
}
