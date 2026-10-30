import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { fontFamily, tabular, useShadcnTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  description?: string;
  icon?: { sf: string; ion: string };
  badge?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shadcn UI Metrik / İstatistik Kartı bileşeni.
 */
export function WebStatCard({ title, value, subtitle, description, icon, badge, style }: StatCardProps) {
  const t = useShadcnTheme();
  const sub = subtitle ?? description;

  return (
    <Card style={[styles.card, style]}>
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: t.mutedForeground }]}>{title.toLocaleUpperCase('tr-TR')}</Text>
        {icon ? (
          <View style={styles.iconWrap}>
            <Icon sf={icon.sf} ion={icon.ion} size={15} color={t.mutedForeground} />
          </View>
        ) : badge}
      </View>
      <View style={styles.content}>
        <Text style={[styles.value, tabular, { color: t.cardForeground }]} numberOfLines={1}>
          {value}
        </Text>
        {sub ? <Text style={[styles.subtitle, { color: t.mutedForeground }]}>{sub}</Text> : null}
      </View>
    </Card>
  );
}

export const StatCard = WebStatCard;

const styles = StyleSheet.create({
  card: {
    padding: 16,
    flex: 1,
    minWidth: 180,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  iconWrap: {
    opacity: 0.8,
  },
  content: {
    gap: 3,
  },
  value: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily,
    fontSize: 12,
  },
});
