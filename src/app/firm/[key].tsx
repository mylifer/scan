import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { SummaryCard } from '../../components/dashboard/SummaryCard';
import { ReceiptList } from '../../components/ReceiptList';
import { EmptyState } from '../../components/ui/EmptyState';
import { ListRow, ListSection } from '../../components/ui/List';
import { useAllReceipts } from '../../hooks/useAllReceipts';
import { showActionSheet } from '../../lib/actionSheet';
import { firmKey, summarizeFirm } from '../../lib/firms';
import { formatTL, shortTrDate } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { SORT_OPTIONS, type SortKey, sortReceipts } from '../../lib/sort';
import { useTheme } from '../../lib/theme';

/** Bir firmanın tüm fişleri, toplam ve KDV tutarları. */
export default function FirmDetailScreen() {
  const theme = useTheme();
  const { key } = useLocalSearchParams<{ key: string }>();
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
        receipts={sorted}
        sort={sort}
        header={`Fişler · ${sorted.length}`}
        headerAction={{ label: SORT_OPTIONS.find((o) => o.key === sort)!.label, onPress: chooseSort, accessibilityLabel: 'Sıralamayı değiştir' }}
      />
    </ScrollView>
  );
}
