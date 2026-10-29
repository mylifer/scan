import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { BUILD_COMMIT, IN_EXPO_GO } from './version';

/** Telefonda (TestFlight / App Store derlemesi) güncelleme denetimi yapılabilir mi (Expo Go'da ve geliştirmede değil) */
const nativeUpdatesEnabled = () => Platform.OS !== 'web' && !IN_EXPO_GO && !__DEV__ && Updates.isEnabled;

/**
 * Telefonda: yeni güncelleme varsa indirir. Varsayılan olarak indirilen güncelleme ancak uygulama tamamen
 * kapatılıp açılınca devreye girer; indirilince true döner ki "Yeni sürüm hazır" gösterilip hemen yüklenebilsin.
 */
async function nativeUpdateReady(): Promise<boolean> {
  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) return false;
  const fetched = await Updates.fetchUpdateAsync();
  return fetched.isNew;
}

/**
 * Web (Ana Ekrana Eklenmiş) sürümde iPhone eski dosyaları önbellekte tutabilir.
 * Yayın sırasında CI, dist/version.json'a commit kodunu yazar; farklıysa yeni sürüm vardır.
 */
async function newerVersionAvailable(): Promise<boolean> {
  const base = (Constants.expoConfig?.experiments?.baseUrl ?? '').replace(/\/$/, '');
  const res = await fetch(`${base}/version.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return false;
  const { commit } = (await res.json()) as { commit?: string };
  return !!commit && commit.slice(0, 7) !== BUILD_COMMIT;
}

/** Yeni sürüm yayınlandıysa (web) ya da indirildiyse (telefon) true; açılışta ve uygulamaya her dönüşte kontrol eder. */
export function useWebUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!nativeUpdatesEnabled()) return;
    let cancelled = false;
    let busy = false;
    const check = () => {
      if (busy) return;
      busy = true;
      nativeUpdateReady()
        .then((ready) => !cancelled && ready && setAvailable(true))
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    };
    check();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || BUILD_COMMIT === 'geliştirme' || typeof document === 'undefined') return;
    let cancelled = false;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      newerVersionAvailable()
        .then((v) => !cancelled && v && setAvailable(true))
        .catch(() => {});
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return available;
}

export function reloadApp() {
  if (nativeUpdatesEnabled()) {
    Updates.reloadAsync().catch(() => {});
    return;
  }
  if (typeof window !== 'undefined') window.location.reload();
}
