import { router } from 'expo-router';

import { SetupSteps } from '../components/SetupSteps';
import { showAlert } from '../lib/alert';
import { haptics } from '../lib/haptics';
import { SCHEMA_SETUP_SQL } from '../lib/setupSql';
import { showToast } from '../lib/toast';
import { schemaReady } from '../services/supabase/schema';

export default function SetupDatabaseScreen() {
  return (
    <SetupSteps
      sql={SCHEMA_SETUP_SQL}
      message="Fiş no, satıcının vergi numarası, ödeme şekli, not alanı ve tüm yeni kategoriler (Ulaşım, Faturalar, Giyim…) için veritabanında küçük bir güncelleme gerekiyor. Mevcut fişleriniz etkilenmez."
      onCheck={async () => {
        const ready = await schemaReady();
        if (ready) {
          haptics.success();
          router.back();
          showToast('Veritabanı güncel');
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
