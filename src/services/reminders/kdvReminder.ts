import * as Notifications from 'expo-notifications';

/**
 * Aylık KDV hatırlatıcısı: her ayın 25'i 10:00'da yerel bildirim.
 * KDV beyannamesi bir sonraki ayın 28'ine kadar verilir; 25'i fişleri muhasebeciye iletmek için pay bırakır.
 */
const ID = 'kdv-reminder';
export const REMINDER_DAY = 25;
export const REMINDER_HOUR = 10;

export const remindersSupported = true;

// Uygulama açıkken gelen bildirim de banner olarak görünsün
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function isReminderEnabled(): Promise<boolean> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.some((n) => n.identifier === ID);
  } catch {
    return false;
  }
}

/** @returns false: kullanıcı bildirim izni vermedi */
export async function enableReminder(): Promise<boolean> {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  await Notifications.cancelScheduledNotificationAsync(ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: 'KDV zamanı yaklaşıyor',
      body: 'Geçen ayın fişlerini kontrol edip Muhasebe Paketi ile muhasebecinize gönderin.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: REMINDER_DAY, hour: REMINDER_HOUR, minute: 0 },
  });
  return true;
}

export async function disableReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ID);
}
