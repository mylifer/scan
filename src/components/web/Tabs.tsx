import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { haptics } from '../../lib/haptics';
import { fontFamily, useShadcnTheme } from '../../lib/theme';

export function TabsList({
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
        styles.list,
        {
          backgroundColor: t.muted,
          borderColor: t.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export function TabsTrigger({
  value,
  active,
  onPress,
  children,
  style,
}: {
  value: string;
  active: boolean;
  onPress: (val: string) => void;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const t = useShadcnTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress(value);
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.trigger,
        active && [
          styles.triggerActive,
          {
            backgroundColor: t.card,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 1,
          },
        ],
        !active && (hovered || pressed) && { backgroundColor: 'rgba(120,120,128,0.1)' },
        style,
      ]}>
      <Text
        style={[
          styles.triggerText,
          {
            color: active ? t.cardForeground : t.mutedForeground,
            fontWeight: active ? '600' : '500',
          },
        ]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    alignSelf: 'flex-start',
    gap: 2,
  },
  trigger: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerActive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  triggerText: {
    fontFamily,
    fontSize: 13,
    letterSpacing: -0.1,
  },
});
