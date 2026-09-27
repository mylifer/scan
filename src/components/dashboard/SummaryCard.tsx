import { Pressable, StyleSheet, Text, View } from 'react-native';

import { budgetStatus } from '../../lib/budgetMath';

import { formatTL } from '../../lib/format';
import { tabular, type Theme, type as t, useTheme } from '../../lib/theme';
import type { compareWithPreviousMonth } from '../../lib/trend';

type Compare = ReturnType<typeof compareWithPreviousMonth>;

interface Props {
  total: number;
  kdv: number;
  count: number;
  compare: Compare;
  /** Aylık görünümde bütçe (yoksa null) */
  budget?: number | null;
  onBudgetPress?: () => void;
}

/** Dönemin toplam gideri, fiş sayısı, geçen ayla karşılaştırma, KDV alacağı ve KDV hariç tutar. */
export function SummaryCard({ total, kdv, count, compare, budget, onBudgetPress }: Props) {
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
      {budget ? <BudgetBar spent={total} budget={budget} theme={theme} onPress={onBudgetPress} /> : null}
      <View style={[styles.hr, { backgroundColor: theme.separator }]} />
      <View style={styles.stats}>
        <Stat label="KDV Alacağı" value={formatTL(kdv)} color={theme.green} theme={theme} />
        <View style={[styles.vr, { backgroundColor: theme.separator }]} />
        <Stat label="KDV Hariç" value={formatTL(total - kdv)} color={theme.label} theme={theme} />
      </View>
    </View>
  );
}

function BudgetBar({ spent, budget, theme, onPress }: { spent: number; budget: number; theme: Theme; onPress?: () => void }) {
  const s = budgetStatus(spent, budget);
  const color = s.level === 'over' ? theme.red : s.level === 'warning' ? theme.orange : theme.green;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Aylık bütçe ${formatTL(budget)}, yüzde ${Math.round(s.ratio * 100)} kullanıldı`}
      style={({ pressed }) => [styles.budget, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.track, { backgroundColor: theme.tertiaryFill }]}>
        <View style={{ width: `${Math.min(100, s.ratio * 100)}%`, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={[t.footnote, tabular, { color: theme.secondaryLabel }]}>
        Bütçe {formatTL(budget)} ·{' '}
        <Text style={{ color: s.level === 'ok' ? theme.secondaryLabel : color, fontWeight: s.level === 'ok' ? '400' : '600' }}>
          {s.level === 'over' ? `${formatTL(s.over)} aşıldı` : `${formatTL(s.remaining)} kaldı`}
        </Text>
      </Text>
    </Pressable>
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
  budget: { marginTop: 12, gap: 6 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
});
