import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * Yerel modül bu kurulumda var mı? Güncellemeler (EAS Update) eski TestFlight derlemesine de gider; o derlemede
 * sonradan eklenen yerel modüller yoktur. Modülü yüklemeden önce bununla bakılır, yoksa özellik gizlenir.
 */
export function hasNativeModule(name: string): boolean {
  if (Platform.OS === 'web') return false;
  try {
    return !!requireOptionalNativeModule(name);
  } catch {
    return false;
  }
}
