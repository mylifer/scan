import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { ListRow, ListSection } from '../components/ui/List';
import { Badge } from '../components/web/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/web/Card';
import { WebPageHeader } from '../components/web/PageHeader';
import { WebSwitch } from '../components/web/Switch';
import { addDays, daysUntil, formatTrDate, taxDeadlines, type TaxDeadline, todayIso } from '../lib/taxCalendar';
import { useWide } from '../lib/layout';
import { fontFamily, tabular, type as t, useShadcnTheme, useTheme } from '../lib/theme';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function remaining(days: number): string {
  if (days === 0) return 'Bugün';
  if (days === 1) return 'Yarın';
  return `${days} gün`;
}

/** Önümüzdeki 12 ayın vergi son günleri (şahıs işletmesi, gerçek usul) */
export default function TaxCalendarScreen() {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
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

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 900, width: '100%', gap: 24 }}>
            <WebPageHeader
              title="Vergi Takvimi"
              description="Önümüzdeki 12 ayın beyanname ve vergi ödeme son günleri (şahıs işletmesi, gerçek usul)."
              onBack={() => router.back()}
              actions={
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: st.border,
                    backgroundColor: st.card,
                  }}>
                  <Text style={{ fontFamily, fontSize: 13, fontWeight: '500', color: st.cardForeground }}>
                    Muhtasar ve Ba-Bs
                  </Text>
                  <WebSwitch
                    checked={showAll}
                    onCheckedChange={setShowAll}
                    accessibilityLabel="Muhtasar ve Ba-Bs'yi göster"
                  />
                </View>
              }
            />

            {groups.map((g) => (
              <Card key={g.key}>
                <CardHeader>
                  <CardTitle>{g.label}</CardTitle>
                </CardHeader>
                <CardContent style={{ gap: 12 }}>
                  {g.items.map((d, i) => {
                    const days = daysUntil(d.date, today);
                    const soon = days <= 3;
                    return (
                      <View
                        key={`${d.kind}-${d.period}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: 16,
                          paddingVertical: 10,
                          borderBottomWidth: i < g.items.length - 1 ? StyleSheet.hairlineWidth : 0,
                          borderBottomColor: st.border,
                        }}>
                        <View
                          style={{
                            width: 48,
                            height: 52,
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: soon ? '#dc2626' : st.muted,
                          }}>
                          <Text
                            style={[
                              tabular,
                              {
                                fontFamily,
                                fontSize: 16,
                                fontWeight: '700',
                                color: soon ? '#ffffff' : st.foreground,
                              },
                            ]}>
                            {Number(d.date.slice(8))}
                          </Text>
                          <Text
                            style={{
                              fontFamily,
                              fontSize: 11,
                              color: soon ? '#ffffff' : st.mutedForeground,
                            }}>
                            {GUN_KISA[weekdayOf(d.date)]}
                          </Text>
                        </View>

                        <View style={{ flex: 1, gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontFamily, fontSize: 14, fontWeight: '600', color: st.cardForeground }}>
                              {d.title}
                            </Text>
                            <Badge variant={soon ? 'destructive' : days <= 7 ? 'secondary' : 'outline'}>
                              {remaining(days)}
                            </Badge>
                          </View>
                          <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>
                            Dönem: {d.period} · Son Gün: {formatTrDate(d.date)}
                          </Text>
                          {d.notes.map((n) => (
                            <Text
                              key={n}
                              style={{
                                fontFamily,
                                fontSize: 12,
                                color: n.includes('yarım gün') || n.includes('doğrulanmadı') ? '#d97706' : st.mutedForeground,
                                marginTop: 2,
                              }}>
                              {n}
                            </Text>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </CardContent>
              </Card>
            ))}

            <View style={{ padding: 14, borderRadius: 8, backgroundColor: st.muted, borderWidth: 1, borderColor: st.border }}>
              <Text style={{ fontFamily, fontSize: 12, lineHeight: 18, color: st.mutedForeground }}>
                Son gün hafta sonuna ya da resmî tatile denk gelirse ilk iş gününe kayar (VUK 18); bu hesaba katılmıştır. Gelir İdaresi zaman zaman ek süre ilan eder; kesin tarih için GİB duyurularını ve muhasebecinizi esas alın.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      <ListSection footer="Muhtasar yalnızca çalışanınız ya da kira stopajınız varsa verilir; Ba-Bs formlarını genellikle muhasebeciniz verir.">
        <ListRow title="Muhtasar ve Ba-Bs'yi Göster" accessory={<Switch value={showAll} onValueChange={setShowAll} accessibilityLabel="Muhtasar ve Ba-Bs'yi göster" />} isLast />
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
                    <Text style={[t.caption2, { color: soon ? '#FFFFFF' : theme.secondaryLabel }]}>{GUN_KISA[weekdayOf(d.date)]}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[t.body, { color: theme.label }]}>{d.title}</Text>
                    <Text style={[t.subhead, { color: theme.secondaryLabel }]}>Dönem: {d.period}</Text>
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
  day: { width: 40, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 + 40 + 12 },
  disclaimer: { marginHorizontal: 32 },
});
