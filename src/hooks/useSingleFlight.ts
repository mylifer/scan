import { useCallback, useRef } from 'react';

/**
 * Aynı anda tek çalıştırma: işlem sürerken gelen ikinci çağrı yok sayılır.
 * `saving` state'i bir sonraki render'a kadar güncellenmediği için hızlı çift dokunuşu
 * (iki kez kaydetme) yalnızca senkron bir ref engelleyebilir.
 *
 * Kullanım (olay işleyicisinin içinde): `await runOnce(async () => { ... })`
 */
export function useSingleFlight() {
  const busy = useRef(false);
  return useCallback(async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } finally {
      busy.current = false;
    }
  }, []);
}
