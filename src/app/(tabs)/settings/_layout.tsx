import { Stack } from 'expo-router';

import { stackScreenOptions, tabRootHeader } from '../../../lib/navigation';
import { useTheme } from '../../../lib/theme';

/** Ayarlar sekmesi */
export default function Layout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="index" options={{ title: 'Ayarlar', ...tabRootHeader(theme) }} />
    </Stack>
  );
}
