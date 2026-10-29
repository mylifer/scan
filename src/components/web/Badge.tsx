import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fontFamily, useShadcnTheme } from '../../lib/theme';

export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive' | 'success';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ children, variant = 'default', style }: BadgeProps) {
  const t = useShadcnTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: t.secondary,
          color: t.secondaryForeground,
          border: 'transparent',
        };
      case 'outline':
        return {
          bg: 'transparent',
          color: t.foreground,
          border: t.border,
        };
      case 'destructive':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: 'rgba(239, 68, 68, 0.25)',
        };
      case 'success':
        return {
          bg: 'rgba(34, 197, 94, 0.15)',
          color: '#22c55e',
          border: 'rgba(34, 197, 94, 0.25)',
        };
      case 'default':
      default:
        return {
          bg: t.primary,
          color: t.primaryForeground,
          border: 'transparent',
        };
    }
  };

  const v = getVariantStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
        },
        style,
      ]}>
      <Text style={[styles.text, { color: v.color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
