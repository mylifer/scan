import { Pressable, StyleSheet, View } from 'react-native';

import { useShadcnTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * Shadcn UI Checkbox bileşeni (16x16, yuvarlatılmış köşeli, erişilebilir).
 */
export function Checkbox({ checked, onCheckedChange, indeterminate, disabled, accessibilityLabel }: CheckboxProps) {
  const t = useShadcnTheme();
  const isActive = checked || indeterminate;

  return (
    <Pressable
      onPress={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.box,
        {
          borderColor: isActive ? t.primary : hovered ? t.foreground : t.border,
          backgroundColor: isActive ? t.primary : 'transparent',
          opacity: disabled ? 0.35 : pressed ? 0.8 : 1,
        },
      ]}>
      {checked ? (
        <Icon sf="checkmark" ion="checkmark" size={11} color={t.primaryForeground} weight="bold" />
      ) : indeterminate ? (
        <View style={[styles.indeterminateBar, { backgroundColor: t.primaryForeground }]} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  indeterminateBar: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
});
