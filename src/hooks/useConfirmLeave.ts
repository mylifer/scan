import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useState } from 'react';

import { confirmDestructive } from '../lib/actionSheet';

/**
 * Kaydedilmemiş değişiklik varken ekrandan çıkmadan önce sorar (geri düğmesi, kaydırarak kapatma).
 * Kaydettikten sonra programla çıkarken `allowLeave()` çağrılır; aksi hâlde onay sorulurdu.
 *
 * SDK 58'de engellenen eylem `navigation.dispatch(data.action)` ile yeniden gönderilmemeli:
 * eylem sıraya girer, işlendiğinde ekran hâlâ engelli olduğundan geri çağrı tekrar tetiklenir ve
 * sonsuz döngü (React hatası #185) oluşur. Bunun yerine engel kapatılıp `repeat()` /
 * `disablePrevention()` kullanılır.
 */
export function useConfirmLeave(dirty: boolean) {
  const [allowed, setAllowed] = useState(false);

  const disablePrevention = usePreventRemove(dirty && !allowed, ({ repeat }) => {
    confirmDestructive('Değişiklikler kaydedilmedi', 'Çıkarsanız girdiğiniz bilgiler kaybolur.', 'Kaydetmeden Çık', () => {
      setAllowed(true);
      repeat();
    });
  });

  return useCallback(() => {
    setAllowed(true);
    disablePrevention();
  }, [disablePrevention]);
}
