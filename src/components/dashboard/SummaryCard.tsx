import { Pressable, StyleSheet, Text, View } from 'react-native';

import { budgetStatus } from '../../lib/budgetMath';
import { formatTL } from '../../lib/format';
import { useWide } from '../../lib/layout';
import { fontFamily, tabular, type Theme, type as t, useShadcnTheme, useTheme } from '../../lib/theme';
import type { compareWithPreviousMonth } from '../../lib/trend';
import { Badge } from '../web/Badge';

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
  const st = useShadcnTheme();
  const wide = useWide();

  if (wide) {
    return (
      <View style={[styles.summaryWide, { backgroundColor: st.card, borderColor: st.border }]}>
        {/* Header row */}
        <View style={styles.headerRowWide}>
          <View style={{ gap: 4 }}>
            <Text style={[styles.microLabelWide, { color: st.mutedForeground }]}>TOPLAM GİDER</Text>
            <View style={styles.amountRowWide}>
              <Text style={[styles.bigNumberWide, tabular, { color: st.cardForeground }]} numberOfLines={1}>
                {formatTL(total)}
              </Text>
              {compare?.changePct != null && compare.changePct !== 0 && (
                <Badge variant={compare.changePct > 0 ? 'destructive' : 'success'}>
                  {compare.changePct > 0 ? `+ %${compare.changePct}` : `- %${Math.abs(compare.changePct)}`}
                </Badge>
              )}
            </View>
          </View>
          <Badge variant="outline" style={{ alignSelf: 'flex-start' }}>
            {count} fiş
          </Badge>
        </View>

        {compare && (
          <Text style={[styles.compareTextWide, { color: st.mutedForeground }]}>
            Geçen ay {formatTL(compare.previousTotal)} tutarındaydı.
          </Text>
        )}

        {budget ? <BudgetBar spent={total} budget={budget} theme={theme} isWide onPress={onBudgetPress} /> : null}

        <View style={[styles.hrWide, { backgroundColor: st.border }]} />

        {/* 2 sub-metrics */}
        <View style={styles.statsWide}>
          <View style={[styles.statBoxWide, { backgroundColor: st.muted, borderColor: st.border }]}>
            <Text style={[styles.statLabelWide, { color: st.mutedForeground }]}>KDV ALACAĞI</Text>
            <Text style={[styles.statValueWide, tabular, { color: theme.green }]} numberOfLines={1}>
              {formatTL(kdv)}
            </Text>
          </View>
          <View style={[styles.statBoxWide, { backgroundColor: st.muted, borderColor: st.border }]}>
            <Text style={[styles.statLabelWide, { color: st.mutedForeground }]}>KDV HARİÇ GİDER</Text>
            <Text style={[styles.statValueWide, tabular, { color: st.cardForeground }]} numberOfLines={1}>
              {formatTL(total - kdv)}
            </Text>
          </View>
        </View>
      </View>
    );
  }

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

function BudgetBar({
  spent,
  budget,
  theme,
  isWide,
  onPress,
}: {
  spent: number;
  budget: number;
  theme: Theme;
  isWide?: boolean;
  onPress?: () => void;
}) {
  const s = budgetStatus(spent, budget);
  const color = s.level === 'over' ? theme.red : s.level === 'warning' ? theme.orange : theme.green;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Aylık bütçe ${formatTL(budget)}, yüzde ${Math.round(s.ratio * 100)} kullanıldı`}
      style={({ pressed }) => [styles.budget, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[styles.track, { backgroundColor: theme.tertiaryFill, height: isWide ? 6 : 8 }]}>
        <View style={{ width: `${Math.min(100, s.ratio * 100)}%`, backgroundColor: color, borderRadius: 3 }} />
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

  // Shadcn Wide Desktop styles
  summaryWide: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  headerRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  microLabelWide: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  amountRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  bigNumberWide: {
    fontFamily,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  compareTextWide: {
    fontFamily,
    fontSize: 13,
    marginTop: 2,
  },
  hrWide: {
    height: 1,
    marginVertical: 12,
  },
  statsWide: {
    flexDirection: 'row',
    gap: 12,
  },
  statBoxWide: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    gap: 2,
  },
  statLabelWide: {
    fontFamily,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  statValueWide: {
    fontFamily,
    fontSize: 18,
    fontWeight: '700',
  },
});
