import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../hooks/useAuth';
import { fontFamily, type as t, useTheme } from '../../lib/theme';
import { VERSION_LABEL } from '../../lib/version';

const ICON = require('../../../assets/icon.png');

/** Masaüstü tarayıcıda alt sekme çubuğunun yerine soldaki gezinme menüsü */
export function WebSidebar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  const { session } = useAuth();
  return (
    <View style={[styles.bar, { backgroundColor: theme.card, borderRightColor: theme.separator }]}>
      <View style={styles.brand}>
        <Image source={ICON} style={styles.logo} accessibilityIgnoresInvertColors />
        <Text style={[t.headline, { color: theme.label }]}>Fiş Tarayıcı</Text>
      </View>

      <View style={styles.items} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const color = focused ? theme.blue : theme.label;
          const label = options.title ?? route.name;
          const onPress = () => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.item,
                { backgroundColor: focused ? theme.fill : hovered || pressed ? theme.fill : 'transparent', opacity: pressed ? 0.7 : 1 },
              ]}>
              {options.tabBarIcon?.({ focused, color, size: 20 })}
              <Text style={[styles.label, { color, fontWeight: focused ? '600' : '400' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        {session?.user.email ? (
          <Text style={[t.footnote, { color: theme.secondaryLabel }]} numberOfLines={1}>
            {session.user.email}
          </Text>
        ) : null}
        <Text style={[t.caption1, { color: theme.tertiaryLabel }]}>Sürüm {VERSION_LABEL}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: 232, borderRightWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 24 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  items: { gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 40, borderRadius: 8 },
  label: { fontFamily, fontSize: 15 },
  footer: { marginTop: 'auto', paddingHorizontal: 8, gap: 2 },
});
