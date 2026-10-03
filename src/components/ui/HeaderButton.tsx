import { Pressable, StyleSheet, Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { type SymbolSpec, useTheme } from '../../lib/theme';
import { Icon } from './Icon';

/** Gezinme çubuğu ikon düğmesi (isteğe bağlı rozetle). */
export function HeaderIconButton({ icon, onPress, badge, label }: { icon: SymbolSpec; onPress: () => void; badge?: number; label: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} yeni` : label}
      style={({ pressed }) => [styles.btn, { opacity: pressed ? 0.5 : 1 }]}>
      <Icon {...icon} size={22} color={theme.blue} />
      {!!badge && (
        <View style={[styles.badge, { backgroundColor: theme.red }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** Gezinme çubuğu metin düğmesi (ör. "Kaydet") */
export function HeaderTextButton({ title, onPress, bold, disabled }: { title: string; onPress: () => void; bold?: boolean; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.5 : 1, paddingHorizontal: 4 })}>
      <Text style={{ color: theme.blue, fontSize: 17, fontWeight: bold ? '600' : '400' }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
