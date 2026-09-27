import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { BUILD_COMMIT } from './version';

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

/** Yeni sürüm yayınlandıysa true; açılışta ve uygulamaya her dönüşte kontrol eder. */
export function useWebUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);
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
  if (typeof window !== 'undefined') window.location.reload();
}
