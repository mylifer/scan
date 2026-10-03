import { useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useRef } from 'react';

import { confirmDestructive } from '../lib/actionSheet';

/**
 * Kaydedilmemiş değişiklik varken ekrandan çıkmadan önce sorar (geri düğmesi, kaydırarak kapatma).
 * Kaydettikten sonra programla çıkarken `allowLeave()` çağrılır; aksi hâlde onay sorulurdu.
 */
export function useConfirmLeave(dirty: boolean) {
  const navigation = useNavigation();
  const allowed = useRef(false);

  usePreventRemove(dirty, ({ data }) => {
    if (allowed.current) {
      navigation.dispatch(data.action);
      return;
    }
    confirmDestructive('Değişiklikler kaydedilmedi', 'Çıkarsanız girdiğiniz bilgiler kaybolur.', 'Kaydetmeden Çık', () =>
      navigation.dispatch(data.action),
    );
  });

  return useCallback(() => {
    allowed.current = true;
  }, []);
}
