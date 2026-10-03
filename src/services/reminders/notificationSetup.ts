import { loadNotifications } from './loadNotifications';

/**
 * Uygulama açıkken gelen bildirim de banner olarak görünsün. Uygulama açılışında (kök layout)
 * bir kez çağrılır. Bildirim paketi yüklenemezse hiçbir şey yapmaz (uygulama yine açılır).
 */
export function setupNotifications() {
  try {
    loadNotifications()?.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch (e) {
    console.warn('Bildirim ayarı yapılamadı', e);
  }
}
