import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { SummaryCard } from '../components/dashboard/SummaryCard';
import { ReceiptList } from '../components/ReceiptList';
import { EmptyState } from '../components/ui/EmptyState';
import { ListRow, ListSection } from '../components/ui/List';
import { SearchField } from '../components/ui/SearchField';
import { useAllReceipts } from '../hooks/useAllReceipts';
import { showActionSheet } from '../lib/actionSheet';
import { round2 } from '../lib/format';
import { haptics } from '../lib/haptics';
import { receiptMatcher } from '../lib/search';
import { SORT_OPTIONS, type SortKey, sortReceipts } from '../lib/sort';
import { useTheme } from '../lib/theme';

/** Bugüne kadar girilen tüm fişler: arama, sıralama, aylara göre gruplu liste. */
export default function AllReceiptsScreen() {
  const theme = useTheme();
  const { receipts, error, loading, refresh } = useAllReceipts();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [pulling, setPulling] = useState(false);

  const filtered = useMemo(() => {
    const matches = receiptMatcher(query);
    return sortReceipts((receipts ?? []).filter(matches), sort);
  }, [receipts, query, sort]);
  const totals = useMemo(
    () => ({
      total: round2(filtered.reduce((a, r) => a + r.toplam_tutar, 0)),
      kdv: round2(filtered.reduce((a, r) => a + r.toplam_kdv, 0)),
    }),
    [filtered],
  );

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

  if (!receipts && loading) return <ActivityIndicator style={{ marginTop: 48 }} />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={async () => {
            setPulling(true);
            await refresh();
            setPulling(false);
          }}
        />
      }>
      {error && (
        <ListSection>
          <ListRow title={receipts ? 'Çevrimdışı · son veriler gösteriliyor' : 'Fişler alınamadı'} subtitle={error} tone="action" onPress={refresh} />
        </ListSection>
      )}
      {receipts && receipts.length === 0 ? (
        <EmptyState icon={{ sf: 'doc.text.viewfinder', ion: 'scan-outline' }} title="Fiş Yok" message="Henüz hiç fiş kaydetmediniz." />
      ) : (
        <>
          <SummaryCard total={totals.total} kdv={totals.kdv} count={filtered.length} compare={null} />
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Firma ya da tutar ara" />
          </View>
          {filtered.length === 0 ? (
            <ListSection>
              <ListRow title="Eşleşen fiş yok" disabled />
            </ListSection>
          ) : (
            <ReceiptList
              receipts={filtered}
              sort={sort}
              header={`Fişler · ${filtered.length}`}
              headerAction={{ label: SORT_OPTIONS.find((o) => o.key === sort)!.label, onPress: chooseSort, accessibilityLabel: 'Sıralamayı değiştir' }}
            />
          )}
        </>
      )}
    </ScrollView>
  );
}
