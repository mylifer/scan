import { Stack } from 'expo-router';

import { stackScreenOptions, tabRootHeader } from '../../../lib/navigation';
import { useTheme } from '../../../lib/theme';

/** e-Faturalar sekmesi: QNB eSolutions gelen/giden */
export default function Layout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="index" options={{ title: 'e-Faturalar', ...tabRootHeader(theme) }} />
    </Stack>
  );
}
