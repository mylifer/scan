import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useWide } from '../../lib/layout';
import { tabular, type as t, useTheme } from '../../lib/theme';

/**
 * Geniş web penceresinde yan yana sütunlar; telefonda içerik olduğu gibi alt alta akar.
 * Sütunların içindeki bölümler kendi 16'lık kenar boşluklarını korur.
 */
export function Columns({ children }: { children: ReactNode }) {
  const wide = useWide();
  if (!wide) return <>{children}</>;
  return <View style={styles.row}>{children}</View>;
}

/** Columns içindeki bir sütun; flex genişlik oranıdır */
export function Column({ children, flex = 1 }: { children: ReactNode; flex?: number }) {
  const wide = useWide();
  if (!wide) return <>{children}</>;
  return <View style={{ flex, minWidth: 0 }}>{children}</View>;
}

export interface Stat {
  label: string;
  value: string;
  /** Değerin altındaki kısa açıklama */
  note?: string;
  /** Değerin rengi (varsayılan: ana metin) */
  color?: string;
}

/** Pano başındaki özet kutuları (geniş ekranda yan yana, dar ekranda ikişerli) */
export function StatTiles({ items }: { items: Stat[] }) {
  const theme = useTheme();
  const wide = useWide();
  return (
    <View style={[styles.tiles, wide && styles.tilesWide]}>
      {items.map((s) => (
        <View key={s.label} style={[styles.tile, wide ? styles.tileWide : styles.tileNarrow, { backgroundColor: theme.card }]}>
          <Text style={[t.footnote, styles.tileLabel, { color: theme.secondaryLabel }]} numberOfLines={1}>
            {s.label.toLocaleUpperCase('tr-TR')}
          </Text>
          <Text style={[styles.tileValue, tabular, { color: s.color ?? theme.label }]} numberOfLines={1} adjustsFontSizeToFit>
            {s.value}
          </Text>
          {s.note ? (
            <Text style={[t.footnote, { color: theme.secondaryLabel }]} numberOfLines={2}>
              {s.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 16, marginBottom: 28 },
  tilesWide: { flexWrap: 'nowrap' },
  tile: { borderRadius: 12, padding: 16, gap: 4 },
  tileWide: { flex: 1, minWidth: 0 },
  tileNarrow: { flexBasis: '47%', flexGrow: 1 },
  tileLabel: { fontWeight: '600', letterSpacing: 0.3 },
  tileValue: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
});
