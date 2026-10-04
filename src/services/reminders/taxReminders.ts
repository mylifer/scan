import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDate, planTaxReminders, REMINDER_PREFIX } from '../../lib/taxReminderPlan';
import { loadNotifications } from './loadNotifications';

/**
 * Vergi takvimi hatırlatıcıları: KDV, geçici vergi ve yıllık gelir vergisi son günlerinden
 * 3 gün önce ve son gün yerel bildirim. Tatil kaydırmaları takvimden gelir.
 * Bildirimler 6 ay ileriye kurulur; uygulama her açıldığında yenilenir.
 */
const KEY = 'tax-reminders:v1';
/** 1.29 öncesindeki "her ayın 25'i" hatırlatıcısı */
const LEGACY_ID = 'kdv-reminder';

/** Bildirim paketi bu ortamda yüklenebiliyorsa true (yüklenemezse Ayarlar'daki satır gizlenir) */
export const remindersSupported = loadNotifications() !== null;

export async function isReminderEnabled(): Promise<boolean> {
  if (!remindersSupported) return false;
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

async function schedule(): Promise<number> {
  const Notifications = loadNotifications();
  if (!Notifications) return 0;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier === LEGACY_ID || n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
  const plan = planTaxReminders(new Date());
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: localDate(r) },
    });
  }
  return plan.length;
}

/** @returns false: kullanıcı bildirim izni vermedi */
export async function enableReminder(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  try {
    await schedule();
    await AsyncStorage.setItem(KEY, '1');
  } catch (e) {
    // Yarım kalan plan kurulu kalmasın (ayar kapalı görünürken bildirim gelmesin)
    await disableReminder().catch(() => {});
    throw e;
  }
  return true;
}

export async function disableReminder(): Promise<void> {
  await AsyncStorage.setItem(KEY, '0').catch(() => {});
  const Notifications = loadNotifications();
  if (!Notifications) return;
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing
      .filter((n) => n.identifier === LEGACY_ID || n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

/**
 * Açılışta çağrılır: açıksa planı 6 ay ileriye yeniler; eski aylık hatırlatıcı kuruluysa
 * yeni takvime taşır. İzin sorulmaz (izin yoksa hiçbir şey yapmaz). Hata fırlatmaz.
 */
export async function refreshTaxReminders(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    let enabled = (await AsyncStorage.getItem(KEY)) === '1';
    if (!enabled && (await AsyncStorage.getItem(KEY)) === null) {
      const legacy = (await Notifications.getAllScheduledNotificationsAsync()).some((n) => n.identifier === LEGACY_ID);
      if (legacy) {
        enabled = true;
        await AsyncStorage.setItem(KEY, '1');
      }
    }
    if (!enabled) return;
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await schedule();
  } catch (e) {
    console.warn('Vergi hatırlatıcıları yenilenemedi', e);
  }
}
