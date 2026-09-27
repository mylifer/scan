import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** iOS dokunsal geri bildirim; web'de sessizce yok sayılır. */
const enabled = Platform.OS !== 'web';

export const haptics = {
  tap: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  select: () => enabled && Haptics.selectionAsync().catch(() => {}),
  success: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
