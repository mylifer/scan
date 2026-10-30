import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native';

import { fontFamily, useShadcnTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: { sf: string; ion: string };
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

/**
 * Shadcn UI Web Buton bileşeni.
 */
export function WebButton({
  children,
  variant = 'default',
  size = 'default',
  icon,
  loading,
  disabled,
  onPress,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const t = useShadcnTheme();

  const getVariantStyles = (hovered: boolean, pressed: boolean) => {
    switch (variant) {
      case 'secondary':
        return {
          bg: hovered || pressed ? t.muted : t.secondary,
          color: t.secondaryForeground,
          border: 'transparent',
          borderWidth: 0,
        };
      case 'outline':
        return {
          bg: hovered || pressed ? t.muted : 'transparent',
          color: t.foreground,
          border: t.border,
          borderWidth: 1,
        };
      case 'ghost':
        return {
          bg: hovered || pressed ? t.muted : 'transparent',
          color: t.foreground,
          border: 'transparent',
          borderWidth: 0,
        };
      case 'destructive':
        return {
          bg: hovered || pressed ? '#dc2626' : t.destructive,
          color: t.destructiveForeground,
          border: 'transparent',
          borderWidth: 0,
        };
      case 'default':
      default:
        return {
          bg: hovered || pressed ? (t.primary === '#18181b' ? '#27272a' : '#e4e4e7') : t.primary,
          color: t.primaryForeground,
          border: 'transparent',
          borderWidth: 0,
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { height: 32, paddingHorizontal: 10, fontSize: 12, iconSize: 13, gap: 5, borderRadius: 6 };
      case 'lg':
        return { height: 42, paddingHorizontal: 20, fontSize: 14, iconSize: 16, gap: 8, borderRadius: 8 };
      case 'icon':
        return { height: 36, width: 36, paddingHorizontal: 0, fontSize: 13, iconSize: 16, gap: 0, borderRadius: 6 };
      case 'default':
      default:
        return { height: 36, paddingHorizontal: 14, fontSize: 13, iconSize: 14, gap: 6, borderRadius: 6 };
    }
  };

  const s = getSizeStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => {
        const v = getVariantStyles(!!hovered, pressed);
        return [
          styles.base,
          {
            height: s.height,
            paddingHorizontal: size === 'icon' ? 0 : s.paddingHorizontal,
            width: size === 'icon' ? s.width : undefined,
            borderRadius: s.borderRadius,
            backgroundColor: v.bg,
            borderColor: v.border,
            borderWidth: v.borderWidth,
            opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
            gap: s.gap,
          },
          style,
        ];
      }}>
      {({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => {
        const v = getVariantStyles(!!hovered, pressed);
        if (loading) {
          return <ActivityIndicator size="small" color={v.color} />;
        }
        return (
          <>
            {icon && <Icon sf={icon.sf} ion={icon.ion} size={s.iconSize} color={v.color} weight="semibold" />}
            {children ? (
              typeof children === 'string' ? (
                <Text
                  style={[
                    styles.text,
                    {
                      color: v.color,
                      fontSize: s.fontSize,
                    },
                    textStyle,
                  ]}>
                  {children}
                </Text>
              ) : (
                children
              )
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  text: {
    fontFamily,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
