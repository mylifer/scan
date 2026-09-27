import { router } from 'expo-router';

import { SetupSteps } from '../components/SetupSteps';
import { showAlert } from '../lib/alert';
import { haptics } from '../lib/haptics';
import { CATEGORIES_SETUP_SQL } from '../lib/setupSql';
import { showToast } from '../lib/toast';
import { categoriesReady } from '../services/supabase/schema';

export default function SetupCategoriesScreen() {
  return (
    <SetupSteps
      sql={CATEGORIES_SETUP_SQL}
      message="Ulaşım, Araç Bakım, Konaklama, İletişim, Faturalar, Kargo, Giyim ve Diğer kategorilerini kullanabilmek için veritabanında küçük bir güncelleme gerekiyor. Mevcut fişleriniz etkilenmez."
      onCheck={async () => {
        const ready = await categoriesReady();
        if (ready) {
          haptics.success();
          router.back();
          showToast('Yeni kategoriler etkin');
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
