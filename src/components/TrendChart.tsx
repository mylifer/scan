import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTL } from '../lib/format';
import { haptics } from '../lib/haptics';
import { tabular, type as t, useTheme } from '../lib/theme';
import { compactTL, type MonthPoint, niceMax } from '../lib/trend';
import { Icon } from './ui/Icon';

const PLOT_HEIGHT = 140;
const AXIS_WIDTH = 40;
const GAP = 2; // yığılmış parçalar arasındaki zemin boşluğu

interface Props {
  data: MonthPoint[];
  /** Ekranda açık olan ay (offset); "Tüm Zamanlar"da null */
  currentOffset: number | null;
  /** Seçili aya geçiş (aylık görünümde) */
  onOpenMonth?: (offset: number) => void;
  isLast?: boolean;
}

/**
 * Son 12 ayın giderleri (Sağlık uygulaması tarzı): her çubuk KDV hariç tutar + KDV.
 * Çubuğa dokununca o ayın değerleri üstte gösterilir.
 */
export function TrendChart({ data, currentOffset, onOpenMonth }: Props) {
  const theme = useTheme();
  const defaultIndex = Math.max(0, data.findIndex((p) => p.offset === (currentOffset ?? 0)));
  const [selected, setSelected] = useState(defaultIndex);
  const point = data[Math.min(selected, data.length - 1)];
  const max = niceMax(Math.max(...data.map((p) => p.total)));
  const ticks = [max, max / 2, 0];
  const px = (v: number) => (v / max) * PLOT_HEIGHT;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[t.footnote, { color: theme.secondaryLabel, fontWeight: '600' }]}>{point.label.toLocaleUpperCase('tr-TR')}</Text>
          <Text style={[t.title2, tabular, { color: theme.label }]}>{formatTL(point.total)}</Text>
          <View style={styles.kdvLine}>
            <View style={[styles.swatch, { backgroundColor: theme.chartKdv }]} />
            <Text style={[t.subhead, tabular, { color: theme.secondaryLabel }]}>KDV {formatTL(point.kdv)}</Text>
          </View>
        </View>
        {onOpenMonth && point.offset !== currentOffset && (
          <Pressable onPress={() => onOpenMonth(point.offset)} hitSlop={10} accessibilityRole="button" style={({ pressed }) => [styles.open, { opacity: pressed ? 0.5 : 1 }]}>
            <Text style={[t.subhead, { color: theme.blue }]}>Bu aya git</Text>
            <Icon sf="chevron.right" ion="chevron-forward" size={12} color={theme.blue} weight="semibold" />
          </Pressable>
        )}
      </View>

      <View style={styles.plotRow}>
        <View style={{ flex: 1, height: PLOT_HEIGHT }}>
          {ticks.map((v) => (
            <View key={v} style={[styles.grid, { bottom: px(v), backgroundColor: theme.separator }]} />
          ))}
          <View style={styles.bars}>
            {data.map((p, i) => {
              const base = Math.max(0, p.total - p.kdv);
              const hasBoth = base > 0 && p.kdv > 0;
              const kdvH = px(p.kdv);
              const baseH = Math.max(0, px(base) - (hasBoth ? GAP : 0));
              const active = i === selected;
              return (
                <Pressable
                  key={p.key}
                  onPress={() => {
                    haptics.select();
                    setSelected(i);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.label}: toplam ${formatTL(p.total)}, KDV ${formatTL(p.kdv)}`}
                  style={styles.slot}>
                  <View style={[styles.bar, { opacity: active ? 1 : 0.4 }]}>
                    {p.kdv > 0 && (
                      <View style={{ height: kdvH, backgroundColor: theme.chartKdv, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                    )}
                    {hasBoth && <View style={{ height: GAP }} />}
                    {base > 0 && (
                      <View
                        style={{
                          height: baseH,
                          backgroundColor: theme.chartBase,
                          borderTopLeftRadius: p.kdv > 0 ? 0 : 4,
                          borderTopRightRadius: p.kdv > 0 ? 0 : 4,
                        }}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ width: AXIS_WIDTH, height: PLOT_HEIGHT }}>
          {ticks.map((v) => (
            <Text key={v} style={[t.caption2, tabular, styles.tick, { bottom: px(v) - 6, color: theme.secondaryLabel }]}>
              {compactTL(v)}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.xAxis, { marginRight: AXIS_WIDTH }]}>
        {data.map((p, i) => (
          <Text
            key={p.key}
            style={[t.caption2, styles.xLabel, { color: i === selected ? theme.label : theme.secondaryLabel, fontWeight: i === selected ? '700' : '400' }]}>
            {p.short}
          </Text>
        ))}
      </View>

      <View style={styles.legend}>
        <LegendItem color={theme.chartBase} label="KDV hariç" textColor={theme.secondaryLabel} />
        <LegendItem color={theme.chartKdv} label="KDV" textColor={theme.secondaryLabel} />
      </View>
    </View>
  );
}

function LegendItem({ color, label, textColor }: { color: string; label: string; textColor: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[t.footnote, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  kdvLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  plotRow: { flexDirection: 'row' },
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  bars: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end' },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '58%', maxWidth: 24 },
  tick: { position: 'absolute', left: 6 },
  xAxis: { flexDirection: 'row', marginTop: -6 },
  xLabel: { flex: 1, textAlign: 'center' },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
});
