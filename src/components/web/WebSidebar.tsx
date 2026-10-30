import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../hooks/useAuth';
import { fontFamily, useShadcnTheme } from '../../lib/theme';
import { VERSION_LABEL } from '../../lib/version';
import { reloadApp, useWebUpdateAvailable } from '../../lib/webUpdate';
import { Badge } from './Badge';

const ICON = require('../../../assets/icon.png');

/**
 * Masaüstü web için Shadcn UI Sidebar bileşeni.
 */
export function WebSidebar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useShadcnTheme();
  const { session } = useAuth();
  const updateAvailable = useWebUpdateAvailable();
  const email = session?.user.email ?? '';
  const initial = email ? email[0]?.toUpperCase() : 'F';

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: t.card,
          borderRightColor: t.border,
        },
      ]}>
      {/* Brand & Workspace Header */}
      <View style={styles.brand}>
        <View style={[styles.logoContainer, { borderColor: t.border }]}>
          <Image source={ICON} style={styles.logo} accessibilityIgnoresInvertColors />
        </View>
        <View style={styles.brandText}>
          <Text style={[styles.brandTitle, { color: t.foreground }]}>Fiş Tarayıcı</Text>
          <View style={styles.versionRow}>
            <Badge variant="outline" style={styles.versionBadge}>
              v{VERSION_LABEL}
            </Badge>
            {updateAvailable && (
              <Pressable
                onPress={reloadApp}
                accessibilityRole="button"
                accessibilityLabel="Yeni sürüm hazır, sayfayı yenile"
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.updateBadge,
                  (hovered || pressed) && { opacity: 0.8 },
                ]}>
                <Badge variant="default" style={styles.updateBadgeInner}>
                  Yenile ↻
                </Badge>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Nav List */}
      <View style={styles.navSection}>
        <Text style={[styles.sectionTitle, { color: t.mutedForeground }]}>MENÜ</Text>
        <View style={styles.items} accessibilityRole="tablist">
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key]!;
            const focused = state.index === index;
            const label = options.title ?? route.name;
            const color = focused ? t.foreground : t.mutedForeground;

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
                  {
                    backgroundColor: focused
                      ? t.secondary
                      : hovered || pressed
                        ? t.muted
                        : 'transparent',
                  },
                ]}>
                <View style={styles.iconWrap}>
                  {options.tabBarIcon?.({ focused, color, size: 18 })}
                </View>
                <Text
                  style={[
                    styles.label,
                    {
                      color,
                      fontWeight: focused ? '600' : '500',
                    },
                  ]}>
                  {label}
                </Text>
                {focused && <View style={[styles.activeIndicator, { backgroundColor: t.primary }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* User Footer Profile */}
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <View style={[styles.avatar, { backgroundColor: t.muted, borderColor: t.border }]}>
          <Text style={[styles.avatarText, { color: t.foreground }]}>{initial}</Text>
        </View>
        <View style={styles.userMeta}>
          {email ? (
            <Text style={[styles.userEmail, { color: t.foreground }]} numberOfLines={1}>
              {email}
            </Text>
          ) : null}
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, { color: t.mutedForeground }]}>Çevrimiçi</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 248,
    borderRightWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 18,
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingBottom: 20,
  },
  logoContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandText: {
    gap: 2,
    flex: 1,
  },
  brandTitle: {
    fontFamily,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  versionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  updateBadge: {
    cursor: 'pointer',
  },
  updateBadgeInner: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  navSection: {
    flex: 1,
    gap: 8,
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  items: {
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 6,
    position: 'relative',
  },
  iconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily,
    fontSize: 14,
    letterSpacing: -0.1,
    flex: 1,
  },
  activeIndicator: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 14,
    paddingHorizontal: 6,
    borderTopWidth: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  userMeta: {
    flex: 1,
    gap: 2,
  },
  userEmail: {
    fontFamily,
    fontSize: 13,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontFamily,
    fontSize: 11,
  },
});
