import { Stack } from 'expo-router';

import { stackScreenOptions, tabRootHeader, wideHeader } from '../../../lib/navigation';
import { DASHBOARD_MAX_WIDTH, useWide } from '../../../lib/layout';
import { useTheme } from '../../../lib/theme';

/** e-Faturalar sekmesi: QNB eSolutions gelen/giden */
export default function Layout() {
  const theme = useTheme();
  // Masaüstü tarayıcıda pano geniş; telefonda ve dar pencerede okunabilir genişlik
  const wide = useWide();
  return (
    <Stack screenOptions={{ ...stackScreenOptions(theme, wide ? DASHBOARD_MAX_WIDTH : undefined), ...(wide ? wideHeader(theme) : {}) }}>
      <Stack.Screen name="index" options={{ title: 'e-Faturalar', ...tabRootHeader(theme) }} />
    </Stack>
  );
}
