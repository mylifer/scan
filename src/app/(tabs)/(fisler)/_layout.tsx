import { Stack } from 'expo-router';

import { largeTitle, stackScreenOptions } from '../../../lib/navigation';
import { useTheme } from '../../../lib/theme';

/** Fişler sekmesi: aylık giderler ve fiş tarama */
export default function Layout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Screen name="index" options={{ title: 'Giderler', ...largeTitle }} />
    </Stack>
  );
}
