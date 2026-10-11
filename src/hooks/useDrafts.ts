import { errorMessage } from '../lib/errors';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { showToast } from '../lib/toast';
import {
  getProcessorState,
  isDue,
  processDrafts,
  type ProcessorState,
  subscribeDraftStatus,
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
      try {
        const ok = await processDrafts(items, refresh);
        await refresh();
        const { stoppedReason } = getProcessorState();
        if (stoppedReason) showToast(`Tarama durdu: ${stoppedReason}`, 'error', 5000);
        else if (ok) showToast(`${ok} fiş tarandı, incelemeye hazır`);
      } catch (e) {
        // run çoğu yerde beklenmeden (fire-and-forget) çağrılır; hata sessizce kaybolmasın
        showToast(`Tarama durdu: ${errorMessage(e)}`, 'error', 5000);
      }
    },
    [refresh],
  );

  // Taslaklar başka yerde (hızlı çekim) okunurken liste güncel kalsın: okunmuş fiş tekrar "Şimdi Tara"ya
  // ya da "Planla"ya düşüp ikinci kez okunmasın. Art arda gelen olaylar tek yenilemede toplanır.
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => refresh(), 400);
    };
    let wasRunning = getProcessorState().running;
    const unsubProcessor = subscribeProcessor((s) => {
      setProcessor(s);
      if (wasRunning !== s.running) soon();
      wasRunning = s.running;
    });
    const unsubDrafts = subscribeDraftStatus(soon);
    return () => {
      mounted.current = false;
      if (timer) clearTimeout(timer);
      unsubProcessor();
      unsubDrafts();
    };
  }, [refresh]);

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
