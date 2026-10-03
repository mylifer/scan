import * as Notifications from 'expo-notifications';

/**
 * Uygulama açıkken gelen bildirim de banner olarak görünsün. Uygulama açılışında (kök layout)
 * bir kez çağrılır; yalnızca Ayarlar açıldığında kaydedilirse ön plandaki hatırlatıcı gösterilmezdi.
 */
export function setupNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}
