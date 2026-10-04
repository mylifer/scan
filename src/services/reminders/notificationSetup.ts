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

/**
 * Bildirime dokunulunca çağrılır (uygulama kapalıyken dokunulduysa açılışta bir kez).
 * @returns aboneliği kaldıran fonksiyon
 */
export function subscribeNotificationTaps(handler: (data: Record<string, unknown>) => void): () => void {
  const Notifications = loadNotifications();
  if (!Notifications) return () => {};
  const handle = (r: { notification: { request: { content: { data?: unknown } } } } | null) => {
    if (!r) return;
    // İşlendi: sonraki açılışlarda aynı bildirim tekrar yönlendirmesin
    try {
      Notifications.clearLastNotificationResponse();
    } catch {
      // önemli değil
    }
    handler((r.notification.request.content.data ?? {}) as Record<string, unknown>);
  };
  try {
    handle(Notifications.getLastNotificationResponse());
  } catch {
    // eski sürüm / desteklenmiyor
  }
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
