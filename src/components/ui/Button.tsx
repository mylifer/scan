import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { haptics } from '../../lib/haptics';
import { useWide } from '../../lib/layout';
import { fontFamily, type SymbolSpec, type as t, useShadcnTheme, useTheme } from '../../lib/theme';
import { Icon } from './Icon';

interface Props {
  title: string;
  onPress: () => void;
  /** iOS / Shadcn buton stilleri */
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
  const st = useShadcnTheme();
  const wide = useWide();

  let bg: string;
  let fg: string;
  let border: string = 'transparent';

  if (wide) {
    if (variant === 'filled') {
      if (tone === 'red') {
        bg = st.destructive;
        fg = st.destructiveForeground;
      } else if (tone === 'green') {
        bg = '#22c55e';
        fg = '#ffffff';
      } else {
        bg = st.primary;
        fg = st.primaryForeground;
      }
    } else if (variant === 'gray') {
      bg = st.secondary;
      fg = st.secondaryForeground;
      border = st.border;
    } else if (variant === 'tinted') {
      bg = st.muted;
      fg = tone === 'red' ? st.destructive : theme[tone];
      border = st.border;
    } else {
      bg = 'transparent';
      fg = tone === 'red' ? st.destructive : st.cardForeground;
    }
  } else {
    const accent = theme[tone];
    bg =
      variant === 'filled' ? accent : variant === 'tinted' ? hexAlpha(accent, 0.15) : variant === 'gray' ? theme.tertiaryFill : 'transparent';
    fg = variant === 'filled' ? '#fff' : accent;
  }

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
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.base,
        wide
          ? [
              size === 'large' ? styles.largeWide : styles.mediumWide,
              {
                borderWidth: border !== 'transparent' ? 1 : 0,
                borderColor: border,
              },
            ]
          : size === 'large'
            ? styles.large
            : styles.medium,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.7 : hovered && wide ? 0.9 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && <Icon {...icon} size={wide ? 15 : size === 'large' ? 18 : 16} color={fg} weight="semibold" />}
          {/* Dar düğmelerde (ör. seçim çubuğu) iki satıra kaymasın; iOS'ta gerekirse yazı küçülür */}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              wide
                ? [styles.labelWide, { color: fg }]
                : size === 'large'
                  ? t.headline
                  : { ...t.subhead, fontWeight: '600' },
              { color: fg, flexShrink: 1 },
            ]}>
            {title}
          </Text>
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

  // Shadcn Wide Button styles
  largeWide: { height: 40, borderRadius: 8, paddingHorizontal: 16 },
  mediumWide: { height: 34, borderRadius: 6, paddingHorizontal: 12 },
  labelWide: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
