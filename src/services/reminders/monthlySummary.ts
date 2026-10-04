import AsyncStorage from '@react-native-async-storage/async-storage';

import { MONTHLY_SUMMARY_ID, MONTHLY_SUMMARY_KIND, type MonthTotals, planMonthlySummary } from '../../lib/monthlySummaryPlan';
import { loadNotifications } from './loadNotifications';

/**
 * Aylık özet bildirimi: her ayın 1'i 10:00'da geçen ayın gider, KDV ve fiş sayısı.
 * Bildirim içeriği kurulduğu andaki rakamlarla sabitlenir; bu yüzden ana sayfa bu ayın özetini
 * her yüklediğinde updateMonthlySummary ile yeniden kurulur.
 */
const KEY = 'monthly-summary:v1';

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

export async function isMonthlySummaryEnabled(): Promise<boolean> {
  if (!loadNotifications()) return false;
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

async function schedule(totals: MonthTotals): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  const n = planMonthlySummary(totals);
  await Notifications.cancelScheduledNotificationAsync(MONTHLY_SUMMARY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: MONTHLY_SUMMARY_ID,
    content: { title: n.title, body: n.body, data: { kind: MONTHLY_SUMMARY_KIND, month: n.month } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date },
  });
}

/** @param totals bu ayın rakamları · @returns false: bildirim izni verilmedi */
export async function enableMonthlySummary(totals: MonthTotals): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications) return false;
  if (!(await Notifications.requestPermissionsAsync()).granted) return false;
  await serial(async () => {
    await schedule(totals);
    await AsyncStorage.setItem(KEY, '1');
  });
  return true;
}

export function disableMonthlySummary(): Promise<void> {
  return serial(async () => {
    await AsyncStorage.setItem(KEY, '0').catch(() => {});
    await loadNotifications()?.cancelScheduledNotificationAsync(MONTHLY_SUMMARY_ID).catch(() => {});
  });
}

/** Ana sayfa bu ayın özetini yükleyince çağrılır; kapalıysa ya da izin yoksa hiçbir şey yapmaz. Hata fırlatmaz. */
export function updateMonthlySummary(totals: MonthTotals): Promise<void> {
  return serial(async () => {
    const Notifications = loadNotifications();
    if (!Notifications) return;
    try {
      if ((await AsyncStorage.getItem(KEY)) !== '1') return;
      if (!(await Notifications.getPermissionsAsync()).granted) return;
      await schedule(totals);
    } catch (e) {
      console.warn('Aylık özet bildirimi kurulamadı', e);
    }
  });
}
