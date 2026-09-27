import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../lib/theme';

/** Ekranın altında buzlu cam arka planlı araç çubuğu. */
export function Toolbar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <BlurView
      intensity={80}
      tint={theme.dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: theme.separator }]}>
      <View style={styles.inner}>{children}</View>
    </BlurView>
  );
}

/** Araç çubuğunun kapladığı yükseklik (içeriğin altına boşluk bırakmak için) */
export function useToolbarHeight(rows = 1) {
  const insets = useSafeAreaInsets();
  return 12 + rows * 50 + (rows - 1) * 10 + Math.max(insets.bottom, 12) + 16;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inner: { gap: 10 },
});
