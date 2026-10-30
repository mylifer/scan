import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { SummaryCard } from '../../components/dashboard/SummaryCard';
import { ReceiptList } from '../../components/ReceiptList';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListRow, ListSection } from '../../components/ui/List';
import { WebButton } from '../../components/web/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/web/Card';
import { WebPageHeader } from '../../components/web/PageHeader';
import { ReceiptTable } from '../../components/web/ReceiptTable';
import { StatCard } from '../../components/web/StatCard';
import { useAllReceipts } from '../../hooks/useAllReceipts';
import { showActionSheet } from '../../lib/actionSheet';
import { firmKey, firmKeyFromParam, summarizeFirm } from '../../lib/firms';
import { formatTL, shortTrDate } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { useWide } from '../../lib/layout';
import { SORT_OPTIONS, type SortKey, sortReceipts } from '../../lib/sort';
import { fontFamily, tabular, useShadcnTheme, useTheme } from '../../lib/theme';
import type { ReceiptRecord } from '../../types/receipt';

/** Bir firmanın tüm fişleri, toplam ve KDV tutarları. */
export default function FirmDetailScreen() {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
  const key = firmKeyFromParam(useLocalSearchParams<{ key: string }>().key);
  const { receipts, error, loading, refresh } = useAllReceipts();
  const [sort, setSort] = useState<SortKey>('newest');

  const own = useMemo(() => (receipts ?? []).filter((r) => firmKey(r.firma_adi) === key), [receipts, key]);
  const sorted = useMemo(() => sortReceipts(own, sort), [own, sort]);
  const s = useMemo(() => summarizeFirm(own), [own]);
  // Başlıkta en sık kullanılan yazım
  const name = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of own) counts.set(r.firma_adi.trim(), (counts.get(r.firma_adi.trim()) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? key ?? 'Firma';
  }, [own, key]);

  function chooseSort() {
    showActionSheet({
      title: 'Sırala',
      options: SORT_OPTIONS.map((o) => ({
        label: o.key === sort ? `✓ ${o.label}` : o.label,
        onPress: () => {
          haptics.select();
          setSort(o.key);
        },
      })),
    });
  }

  const title = <Stack.Screen options={{ title: name }} />;

  if (!receipts && loading) return <ActivityIndicator style={{ marginTop: 48 }} />;

  if (receipts && own.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center' }}>
        {title}
        <EmptyState icon={{ sf: 'building.2', ion: 'business-outline' }} title="Fiş Yok" message="Bu firmaya ait fiş kalmadı." />
      </View>
    );
  }

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 1100, width: '100%', gap: 24 }}>
            <WebPageHeader
              title={name}
              description={`${s.count} fiş kaydı · Toplam ${formatTL(s.total)} harcama ve ${formatTL(s.kdv)} KDV.`}
              onBack={() => router.back()}
            />

            {error && (
              <Card style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#991b1b' }}>Çevrimdışı</CardTitle>
                  <CardDescription style={{ color: '#b91c1c' }}>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                  <WebButton variant="outline" onPress={refresh}>
                    Yenile
                  </WebButton>
                </CardContent>
              </Card>
            )}

            <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
              <StatCard
                title="Toplam Harcama"
                value={formatTL(s.total)}
                description="Bu firmaya ait toplam fiş tutarı"
                icon={{ sf: 'creditcard.fill', ion: 'card' }}
                style={{ flex: 1, minWidth: 200 }}
              />
              <StatCard
                title="Toplam KDV"
                value={formatTL(s.kdv)}
                description="İndirilebilecek toplam KDV"
                icon={{ sf: 'percent', ion: 'calculator' }}
                style={{ flex: 1, minWidth: 200 }}
              />
              <StatCard
                title="Fiş Adedi"
                value={`${s.count} adet`}
                description="Kayıtlı fiş sayısı"
                icon={{ sf: 'doc.text.fill', ion: 'receipt' }}
                style={{ flex: 1, minWidth: 200 }}
              />
              <StatCard
                title="Ortalama Fiş"
                value={formatTL(s.average)}
                description="Fiş başına düşen harcama"
                icon={{ sf: 'chart.bar.fill', ion: 'bar-chart' }}
                style={{ flex: 1, minWidth: 200 }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 20 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Firma Özeti</CardTitle>
                    <CardDescription>Fiş tarihleri ve harcama istatistikleri.</CardDescription>
                  </CardHeader>
                  <CardContent style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>Ortalama Fiş</Text>
                      <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{formatTL(s.average)}</Text>
                    </View>
                    {s.first && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>İlk Fiş Tarihi</Text>
                        <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{shortTrDate(s.first)}</Text>
                      </View>
                    )}
                    {s.last && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>Son Fiş Tarihi</Text>
                        <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{shortTrDate(s.last)}</Text>
                      </View>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>KDV Dağılımı</CardTitle>
                    <CardDescription>Vergi dilimlerine göre KDV tutarları.</CardDescription>
                  </CardHeader>
                  <CardContent style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>%1 KDV</Text>
                      <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{formatTL(s.kdv1)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>%10 KDV</Text>
                      <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{formatTL(s.kdv10)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>%20 KDV</Text>
                      <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{formatTL(s.kdv20)}</Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: st.border, marginVertical: 4 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily, fontSize: 14, fontWeight: '700', color: st.cardForeground }}>Toplam KDV</Text>
                      <Text style={[{ fontFamily, fontSize: 14, fontWeight: '700', color: '#16a34a' }, tabular]}>{formatTL(s.kdv)}</Text>
                    </View>
                  </CardContent>
                </Card>
              </View>

              <View style={{ flex: 1.8 }}>
                <Card>
                  <CardHeader>
                    <CardTitle>Kayıtlı Fişler ({sorted.length})</CardTitle>
                    <CardDescription>Bu firmaya ait tüm harcama belgeleri.</CardDescription>
                  </CardHeader>
                  <CardContent style={{ padding: 0 }}>
                    <ReceiptTable
                      receipts={sorted}
                      sort={sort}
                      onSort={setSort}
                      onOpen={(r: ReceiptRecord) => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
                    />
                  </CardContent>
                </Card>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      {title}
      {error && (
        <ListSection>
          <ListRow title="Çevrimdışı · son veriler gösteriliyor" subtitle={error} tone="action" onPress={refresh} />
        </ListSection>
      )}
      <SummaryCard total={s.total} kdv={s.kdv} count={s.count} compare={null} />

      <ListSection header="Bilgiler">
        <ListRow title="Ortalama Fiş" value={formatTL(s.average)} />
        {s.first && <ListRow title="İlk Fiş" value={shortTrDate(s.first)} />}
        {s.last && <ListRow title="Son Fiş" value={shortTrDate(s.last)} />}
      </ListSection>

      <ListSection header="KDV Dağılımı">
        <ListRow title="%1" value={formatTL(s.kdv1)} />
        <ListRow title="%10" value={formatTL(s.kdv10)} />
        <ListRow title="%20" value={formatTL(s.kdv20)} />
        <ListRow title="Toplam KDV" value={formatTL(s.kdv)} valueColor={theme.green} />
      </ListSection>

      <ReceiptList
        key={sort}
        receipts={sorted}
        sort={sort}
        header={`Fişler · ${sorted.length}`}
        headerAction={{ label: SORT_OPTIONS.find((o) => o.key === sort)!.label, onPress: chooseSort, accessibilityLabel: 'Sıralamayı değiştir' }}
      />
    </ScrollView>
  );
}
