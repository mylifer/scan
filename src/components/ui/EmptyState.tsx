import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type SymbolSpec, type as t, useTheme } from '../../lib/theme';
import { Icon } from './Icon';

/** iOS "ContentUnavailableView" benzeri boş durum. */
export function EmptyState({ icon, title, message, children }: { icon: SymbolSpec; title: string; message?: string; children?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <Icon {...icon} size={48} color={theme.secondaryLabel} />
      <Text style={[t.title2, { color: theme.label, textAlign: 'center', marginTop: 12 }]}>{title}</Text>
      {message && <Text style={[t.subhead, { color: theme.secondaryLabel, textAlign: 'center' }]}>{message}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, paddingHorizontal: 32, paddingVertical: 48 },
});
