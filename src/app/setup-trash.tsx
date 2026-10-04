import { router } from 'expo-router';

import { SetupSteps } from '../components/SetupSteps';
import { showAlert } from '../lib/alert';
import { haptics } from '../lib/haptics';
import { TRASH_SETUP_SQL } from '../lib/setupSql';
import { showToast } from '../lib/toast';
import { trashReady } from '../services/supabase/schema';

export default function SetupTrashScreen() {
  return (
    <SetupSteps
      sql={TRASH_SETUP_SQL}
      message="Silinen fişlerin 30 gün boyunca geri alınabilmesi için veritabanında küçük bir güncelleme gerekiyor. Mevcut fişleriniz etkilenmez."
      onCheck={async () => {
        const ready = await trashReady();
        if (ready) {
          haptics.success();
          router.replace('/trash');
          showToast('Çöp kutusu etkin');
        } else {
          haptics.error();
          showAlert(
            'Henüz tamamlanmadı',
            ready === null ? 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.' : 'Kodu SQL ekranında çalıştırıp "Success" yazısını gördükten sonra tekrar deneyin.',
          );
        }
      }}
    />
  );
}
