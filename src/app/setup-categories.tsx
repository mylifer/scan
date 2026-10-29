import { router } from 'expo-router';

import { SetupSteps } from '../components/SetupSteps';
import { showAlert } from '../lib/alert';
import { haptics } from '../lib/haptics';
import { EXTRAS_SETUP_SQL, SENT_SETUP_SQL } from '../lib/setupSql';
import { showToast } from '../lib/toast';
import { categoriesReady } from '../services/supabase/schema';

export default function SetupCategoriesScreen() {
  return (
    <SetupSteps
      sql={EXTRAS_SETUP_SQL + SENT_SETUP_SQL}
      message="Yeni kategorileri (Sağlık, Kira, Abonelik ve fazlası), kendi kategorilerinizi ve fiş no, VKN, not, etiket ve “muhasebeciye gönderildi” alanlarını kullanabilmek için veritabanında küçük bir güncelleme gerekiyor. Mevcut fişleriniz etkilenmez."
      onCheck={async () => {
        const ready = await categoriesReady();
        if (ready) {
          haptics.success();
          router.back();
          showToast('Veritabanı güncellendi');
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
