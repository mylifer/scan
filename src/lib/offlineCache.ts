import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * İnternet yokken ana sayfanın boş kalmaması için son yüklenen özeti cihazda saklar.
 * Her görünüm türü (ay / yıl / tümü) için yalnızca son bakılan dönem tutulur; yer kaplamaz.
 */
const PREFIX = 'offline-cache:v1:';

interface Entry<T> {
  key: string;
  savedAt: number;
  value: T;
}

export async function readCache<T>(slot: string, key: string): Promise<{ value: T; savedAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    return entry.key === key ? { value: entry.value, savedAt: entry.savedAt } : null;
  } catch {
    return null;
  }
}

export async function writeCache<T>(slot: string, key: string, value: T): Promise<void> {
  try {
    const entry: Entry<T> = { key, savedAt: Date.now(), value };
    await AsyncStorage.setItem(PREFIX + slot, JSON.stringify(entry));
  } catch {
    // Depolama dolu ya da kapalı: önbellek isteğe bağlı, sessizce geç
  }
}

/** Çıkış yapılınca başka hesabın verisi görünmesin */
export async function clearCache(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // yok say
  }
}
