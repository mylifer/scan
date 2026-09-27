import { errorMessage } from '../lib/errors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { showToast } from '../lib/toast';
import {
  getProcessorState,
  isDue,
  processDrafts,
  type ProcessorState,
  subscribeProcessor,
} from '../services/drafts/draftProcessor';
import { DraftsNotSetUpError, listDrafts } from '../services/supabase/draftsRepository';
import type { ReceiptDraft } from '../types/receipt';

/**
 * Taslak listesini ve tarama kuyruğunun durumunu verir.
 * Ekran açıldığında zamanı gelmiş planlı taslakları otomatik taratır.
 */
export function useDrafts() {
  const [drafts, setDrafts] = useState<ReceiptDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [notSetUp, setNotSetUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processor, setProcessor] = useState<ProcessorState>(getProcessorState());
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const list = await listDrafts();
      if (!mounted.current) return list;
      setDrafts(list);
      setNotSetUp(false);
      setError(null);
      return list;
    } catch (e) {
      if (e instanceof DraftsNotSetUpError) setNotSetUp(true);
      else setError(errorMessage(e));
      return [];
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const run = useCallback(
    async (items: ReceiptDraft[]) => {
      const ok = await processDrafts(items, refresh);
      await refresh();
      const { stoppedReason } = getProcessorState();
      if (stoppedReason) showToast(`Tarama durdu: ${stoppedReason}`, 'error', 5000);
      else if (ok) showToast(`${ok} fiş tarandı, incelemeye hazır`);
    },
    [refresh],
  );

  useEffect(() => {
    mounted.current = true;
    const unsub = subscribeProcessor(setProcessor);
    return () => {
      mounted.current = false;
      unsub();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().then((list) => {
        const due = list.filter((d) => isDue(d));
        if (due.length && !getProcessorState().running) run(due);
      });
    }, [refresh, run]),
  );

  return { drafts, loading, notSetUp, error, processor, refresh, run };
}
