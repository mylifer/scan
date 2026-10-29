import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { hasNativeModule } from './nativeModules';

const KEY = 'app-lock:v1';
/** Arka plandan bu süreden kısa dönüşlerde tekrar sorulmaz (ör. başka uygulamaya kısa geçiş) */
export const LOCK_GRACE_MS = 60_000;

let enabled = false;
let loaded = false;
const listeners = new Set<() => void>();

/** Bu cihazda kilit kullanılabilir mi (telefonda, yerel modül varsa; web'de yok) */
export const lockAvailable = () => hasNativeModule('ExpoLocalAuthentication');

async function auth() {
  return import('expo-local-authentication');
}

/** Kayıtlı ayarı okur (açılışta bir kez) */
export async function loadAppLock(): Promise<boolean> {
  if (!lockAvailable()) {
    enabled = false;
  } else {
    try {
      enabled = (await AsyncStorage.getItem(KEY)) === '1';
    } catch {
      enabled = false;
    }
  }
  loaded = true;
  listeners.forEach((l) => l());
  return enabled;
}

export const isAppLockEnabled = () => enabled;
export const isAppLockLoaded = () => loaded;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppLockEnabled(): boolean {
  return useSyncExternalStore(subscribe, isAppLockEnabled, isAppLockEnabled);
}

/** "Face ID", "Touch ID" ya da cihaz şifresi (yüz/parmak izi kayıtlı değilse) */
export async function lockMethodLabel(): Promise<string> {
  if (!lockAvailable()) return 'Kilit';
  try {
    const LA = await auth();
    if (!(await LA.hasHardwareAsync()) || !(await LA.isEnrolledAsync())) return 'Cihaz Şifresi';
    const types = await LA.supportedAuthenticationTypesAsync();
    if (types.includes(LA.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LA.AuthenticationType.FINGERPRINT)) return 'Touch ID';
    return 'Cihaz Şifresi';
  } catch {
    return 'Kilit';
  }
}

/** Face ID / Touch ID ister; olmazsa cihaz şifresine düşer. Başarılıysa true */
export async function authenticate(reason = 'Fiş Tarayıcı’yı açmak için kimliğinizi doğrulayın'): Promise<boolean> {
  if (!lockAvailable()) return true;
  try {
    const LA = await auth();
    const r = await LA.authenticateAsync({ promptMessage: reason, cancelLabel: 'Vazgeç', fallbackLabel: 'Şifre Kullan' });
    return r.success;
  } catch {
    return false;
  }
}

/** Kilidi açar/kapatır. Açarken önce bir kez doğrulama istenir (yanlışlıkla kilitlenip kalınmasın). */
export async function setAppLock(on: boolean): Promise<boolean> {
  if (on && !(await authenticate('Kilidi etkinleştirmek için kimliğinizi doğrulayın'))) return false;
  try {
    if (on) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch {
    return false;
  }
  enabled = on;
  listeners.forEach((l) => l());
  return true;
}
