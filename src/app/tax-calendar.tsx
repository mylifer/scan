import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ListRow, ListSection } from '../components/ui/List';
import { addDays, daysUntil, formatTrDate, taxDeadlines, type TaxDeadline, todayIso } from '../lib/taxCalendar';
import { tabular, type as t, useTheme } from '../lib/theme';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function remaining(days: number): string {
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Yarın';
  return `${days} gün`;
}

/** Önümüzdeki 12 ayın vergi son günleri (şahıs işletmesi, gerçek usul) */
export default function TaxCalendarScreen() {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);
  const today = todayIso();

  const groups = useMemo(() => {
    const list = taxDeadlines(today, addDays(today, 365)).filter((d) => showAll || d.remind);
    const out: { key: string; label: string; items: TaxDeadline[] }[] = [];
    for (const d of list) {
      const key = d.date.slice(0, 7);
      let g = out[out.length - 1];
      if (g?.key !== key) {
        g = { key, label: `${AYLAR[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`, items: [] };
        out.push(g);
      }
      g.items.push(d);
    }
    return out;
  }, [today, showAll]);

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      <ListSection footer="Muhtasar yalnızca çalışanınız ya da kira stopajınız varsa verilir; Ba-Bs formlarını genellikle muhasebeciniz verir.">
        <ListRow title="Muhtasar ve Ba-Bs'yi Göster" accessory={<Switch value={showAll} onValueChange={setShowAll} />} isLast />
      </ListSection>

      {groups.map((g) => (
        <ListSection key={g.key} header={g.label}>
          {g.items.map((d, i) => {
            const days = daysUntil(d.date, today);
            const soon = days <= 3;
            return (
              <View
                key={`${d.kind}-${d.period}`}
                accessible
                accessibilityLabel={`${d.title}, ${d.period}. Son gün ${formatTrDate(d.date)}, ${remaining(days)}. ${d.notes.join(' ')}`}>
                <View style={styles.row}>
                  <View style={[styles.day, { backgroundColor: soon ? theme.red : theme.tertiaryFill }]}>
                    <Text style={[t.headline, tabular, { color: soon ? '#FFFFFF' : theme.label }]}>{Number(d.date.slice(8))}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.body, { color: theme.label }]}>{d.title}</Text>
                    <Text style={[t.subhead, { color: theme.secondaryLabel }]}>
                      {d.period} · {formatTrDate(d.date).split(' ').pop()}
                    </Text>
                    {d.notes.map((n) => (
                      <Text key={n} style={[t.footnote, { color: n.includes('yarım gün') || n.includes('doğrulanmadı') ? theme.orange : theme.secondaryLabel, marginTop: 4 }]}>
                        {n}
                      </Text>
                    ))}
                  </View>
                  <Text style={[t.subhead, tabular, { color: soon ? theme.red : theme.secondaryLabel }]}>{remaining(days)}</Text>
                </View>
                {i < g.items.length - 1 && <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
              </View>
            );
          })}
        </ListSection>
      ))}

      <Text style={[t.footnote, styles.disclaimer, { color: theme.secondaryLabel }]}>
        Son gün hafta sonuna ya da resmî tatile denk gelirse ilk iş gününe kayar (VUK 18); bu hesaba katılmıştır. Gelir İdaresi zaman zaman ek süre ilan eder; kesin tarih için GİB duyurularını ve muhasebecinizi esas alın.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  day: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 + 36 + 12 },
  disclaimer: { marginHorizontal: 32 },
});
