import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { haptics } from '../../lib/haptics';
import { type SymbolSpec, type as t, useTheme } from '../../lib/theme';
import { Icon } from './Icon';

interface Props {
  title: string;
  onPress: () => void;
  /** iOS 15+ buton stilleri */
  variant?: 'filled' | 'tinted' | 'gray' | 'plain';
  tone?: 'blue' | 'red' | 'green';
  icon?: SymbolSpec;
  loading?: boolean;
  disabled?: boolean;
  size?: 'large' | 'medium';
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'filled',
  tone = 'blue',
  icon,
  loading,
  disabled,
  size = 'large',
  style,
}: Props) {
  const theme = useTheme();
  const accent = theme[tone];
  const bg =
    variant === 'filled' ? accent : variant === 'tinted' ? hexAlpha(accent, 0.15) : variant === 'gray' ? theme.tertiaryFill : 'transparent';
  const fg = variant === 'filled' ? '#fff' : accent;
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      // Yüklenirken başlık yerine dönen gösterge çıktığı için etiket ayrıca verilir
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'large' ? styles.large : styles.medium,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon {...icon} size={size === 'large' ? 18 : 16} color={fg} weight="semibold" />}
          <Text style={[size === 'large' ? t.headline : { ...t.subhead, fontWeight: '600' }, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** "#RRGGBB" → "rgba(r,g,b,a)" */
export function hexAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  large: { height: 50, borderRadius: 14 },
  medium: { height: 36, borderRadius: 18, paddingHorizontal: 14 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
