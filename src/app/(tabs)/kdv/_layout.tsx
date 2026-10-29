import { Stack } from 'expo-router';

import { largeTitle, stackScreenOptions } from '../../../lib/navigation';
import { useTheme } from '../../../lib/theme';

/** KDV sekmesi: ay ay kestiğim ve düşebileceğim KDV */
export default function Layout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="index" options={{ title: 'KDV', ...largeTitle }} />
    </Stack>
  );
}
