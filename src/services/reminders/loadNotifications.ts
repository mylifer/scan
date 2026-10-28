import type * as NotificationsModule from 'expo-notifications';

import { IN_EXPO_GO } from '../../lib/version';

let cached: typeof NotificationsModule | null | undefined;

/**
 * expo-notifications'ı ilk ihtiyaçta ve korumalı yükler. Paket içe aktarılırken bir düzine yerel modülü
 * requireNativeModule ile ister; biri bile yoksa (ör. Expo Go'nun bu sürümünde) içe aktarma hata fırlatır.
 * Üst düzeyde import edildiğinde bu, uygulamanın hiç açılamamasına (Expo Go'nun eski sürüme dönmesine)
 * yol açıyordu. Yüklenemezse null döner ve hatırlatıcı özelliği gizlenir.
 */
export function loadNotifications(): typeof NotificationsModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- bilinçli tembel ve korumalı yükleme
    cached = require('expo-notifications') as typeof NotificationsModule;
  } catch (e) {
    console.warn('expo-notifications yüklenemedi; hatırlatıcı devre dışı', e);
    cached = null;
  }
  return cached;
}

/**
 * iOS alt başlığı: Expo Go içinde iOS bildirimi "Expo Go" adı ve simgesiyle gösterir (koddan değiştirilemez);
 * bildirimin Fiş Tarayıcı'dan geldiği alt başlıktan anlaşılsın. Kendi derlemesinde (TestFlight) ad zaten görünür.
 */
export const NOTIFICATION_SUBTITLE = IN_EXPO_GO ? 'Fiş Tarayıcı' : undefined;
