import { Stack } from 'expo-router';

import { stackScreenOptions, tabRootHeader, wideHeader } from '../../../lib/navigation';
import { useWide } from '../../../lib/layout';
import { useTheme } from '../../../lib/theme';

/** Ayarlar sekmesi */
export default function Layout() {
  const theme = useTheme();
  const wide = useWide();
  return (
    <Stack screenOptions={{ ...stackScreenOptions(theme), ...(wide ? wideHeader(theme) : {}) }}>
      <Stack.Screen name="index" options={{ title: 'Ayarlar', ...tabRootHeader(theme) }} />
    </Stack>
  );
}
