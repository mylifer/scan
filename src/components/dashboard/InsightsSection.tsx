import { StyleSheet, Text, View } from 'react-native';

import type { Insight, InsightKind } from '../../lib/insights';
import { type Theme, type as t, useTheme } from '../../lib/theme';
import { IconTile } from '../ui/IconTile';
import { ListSection } from '../ui/List';

const ICONS: Record<InsightKind, { sf: string; ion: string; color: keyof Theme }> = {
  'category-up': { sf: 'arrow.up.right', ion: 'trending-up', color: 'orange' },
  'category-down': { sf: 'arrow.down.right', ion: 'trending-down', color: 'green' },
  'top-firm': { sf: 'storefront.fill', ion: 'storefront', color: 'blue' },
  largest: { sf: 'doc.text.fill', ion: 'document-text', color: 'indigo' },
  kdv: { sf: 'percent', ion: 'calculator', color: 'teal' },
  pace: { sf: 'speedometer', ion: 'speedometer', color: 'purple' },
};

/** Aylık görünümde kural tabanlı kısa özet cümleleri (yapay zekâ kullanmaz). */
export function InsightsSection({ items }: { items: Insight[] }) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <ListSection header="Öne Çıkanlar">
      {items.map((i, idx) => {
        const icon = ICONS[i.kind];
        return (
          <View key={i.kind} accessible accessibilityLabel={i.text}>
            <View style={styles.row}>
              <IconTile sf={icon.sf} ion={icon.ion} color={theme[icon.color] as string} />
              <Text style={[t.subhead, styles.text, { color: theme.label }]}>{i.text}</Text>
            </View>
            {idx < items.length - 1 && <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
          </View>
        );
      })}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44 },
  text: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 + 29 + 12 },
});
