import { StyleSheet, Text, View } from 'react-native';

import { formatTL } from '../../lib/format';
import { tabular, type Theme, type as t, useTheme } from '../../lib/theme';
import type { compareWithPreviousMonth } from '../../lib/trend';

type Compare = ReturnType<typeof compareWithPreviousMonth>;

interface Props {
  total: number;
  kdv: number;
  count: number;
  compare: Compare;
}

/** Dönemin toplam gideri, fiş sayısı, geçen ayla karşılaştırma, KDV alacağı ve KDV hariç tutar. */
export function SummaryCard({ total, kdv, count, compare }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.summary, { backgroundColor: theme.card }]}>
      <Text style={[t.footnote, { color: theme.secondaryLabel, fontWeight: '600' }]}>TOPLAM GİDER</Text>
      <Text style={[styles.bigNumber, tabular, { color: theme.label }]} adjustsFontSizeToFit numberOfLines={1}>
        {formatTL(total)}
      </Text>
      <Text style={[t.subhead, { color: theme.secondaryLabel }]}>
        {count} fiş
        {compare && ` · Geçen ay ${formatTL(compare.previousTotal)}`}
        {compare?.changePct != null && compare.changePct !== 0 && (
          <Text style={{ color: compare.changePct > 0 ? theme.orange : theme.green }}>
            {` (%${Math.abs(compare.changePct)} ${compare.changePct > 0 ? 'fazla' : 'az'})`}
          </Text>
        )}
      </Text>
      <View style={[styles.hr, { backgroundColor: theme.separator }]} />
      <View style={styles.stats}>
        <Stat label="KDV Alacağı" value={formatTL(kdv)} color={theme.green} theme={theme} />
        <View style={[styles.vr, { backgroundColor: theme.separator }]} />
        <Stat label="KDV Hariç" value={formatTL(total - kdv)} color={theme.label} theme={theme} />
      </View>
    </View>
  );
}

function Stat({ label, value, color, theme }: { label: string; value: string; color: string; theme: Theme }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[t.footnote, { color: theme.secondaryLabel }]}>{label}</Text>
      <Text style={[t.title3, tabular, { color }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginHorizontal: 16, marginBottom: 28, borderRadius: 12, padding: 16, gap: 2 },
  bigNumber: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -0.5 },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  vr: { width: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  stats: { flexDirection: 'row' },
});
