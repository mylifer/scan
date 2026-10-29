import { Stack } from 'expo-router';

import { stackScreenOptions, tabRootHeader } from '../../../lib/navigation';
import { useTheme } from '../../../lib/theme';

/** KDV sekmesi: ay ay kestiğim ve düşebileceğim KDV */
export default function Layout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="index" options={{ title: 'KDV', ...tabRootHeader(theme) }} />
    </Stack>
  );
}
