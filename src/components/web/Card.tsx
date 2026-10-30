import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

import { fontFamily, useShadcnTheme } from '../../lib/theme';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, style }: CardProps) {
  const t = useShadcnTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: t.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function CardHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.header, style]}>{children}</View>;
}

export function CardTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const t = useShadcnTheme();
  return (
    <Text style={[styles.title, { color: t.cardForeground }, style]}>
      {children}
    </Text>
  );
}

export function CardDescription({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const t = useShadcnTheme();
  return (
    <Text style={[styles.description, { color: t.mutedForeground }, style]}>
      {children}
    </Text>
  );
}

export function CardContent({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.content, style]}>{children}</View>;
}

export function CardFooter({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useShadcnTheme();
  return (
    <View style={[styles.footer, { borderTopColor: t.border }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 4,
  },
  title: {
    fontFamily,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  description: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
