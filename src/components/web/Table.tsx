import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fontFamily, tabular, useShadcnTheme } from '../../lib/theme';

export function Table({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const t = useShadcnTheme();
  return (
    <View
      style={[
        styles.table,
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

export function TableHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const t = useShadcnTheme();
  return (
    <View style={[styles.header, { borderBottomColor: t.border }, style]}>
      {children}
    </View>
  );
}

export function TableBody({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={style}>{children}</View>;
}

export function TableRow({
  children,
  onPress,
  style,
  isHeader,
  isLast,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  isHeader?: boolean;
  isLast?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useShadcnTheme();

  if (isHeader || !onPress) {
    return (
      <View
        style={[
          styles.row,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
          style,
        ]}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
        (hovered || pressed) && { backgroundColor: t.muted },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

export function TableHead({
  children,
  flex = 1,
  align = 'left',
  onPress,
  style,
}: {
  children: ReactNode;
  flex?: number;
  align?: 'left' | 'right' | 'center';
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const t = useShadcnTheme();
  const textAlign = align;

  const content = (
    <Text
      style={[
        styles.headText,
        {
          color: t.mutedForeground,
          textAlign,
        },
      ]}>
      {children}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.cell,
          { flex },
          (hovered || pressed) && { opacity: 0.8 },
          style,
        ]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.cell, { flex }, style]}>{content}</View>;
}

export function TableCell({
  children,
  flex = 1,
  align = 'left',
  numeric,
  style,
}: {
  children: ReactNode;
  flex?: number;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
  style?: ViewStyle;
}) {
  const t = useShadcnTheme();
  return (
    <View style={[styles.cell, { flex }, style]}>
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          style={[
            styles.cellText,
            numeric && tabular,
            {
              color: t.cardForeground,
              textAlign: align,
            },
          ]}
          numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 44,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 0,
    justifyContent: 'center',
  },
  headText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cellText: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
  },
});
