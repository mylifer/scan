import { Alert, Platform } from 'react-native';

/** Alert.alert web'de çalışmadığı için tarayıcının kendi pencerelerine düşer. */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}
