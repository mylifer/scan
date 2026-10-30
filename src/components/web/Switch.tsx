import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useShadcnTheme } from '../../lib/theme';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Shadcn UI Web Switch bileşeni.
 */
export function WebSwitch({ checked, onCheckedChange, disabled, accessibilityLabel, style }: SwitchProps) {
  const t = useShadcnTheme();

  return (
    <Pressable
      onPress={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        styles.track,
        {
          backgroundColor: checked ? t.primary : t.border,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}>
      <View
        style={[
          styles.thumb,
          {
            backgroundColor: t.card,
            transform: [{ translateX: checked ? 16 : 2 }],
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 38,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  thumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});
