import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState } from '../components/ui/EmptyState';
import { ListRow, ListSection } from '../components/ui/List';
import { SearchField } from '../components/ui/SearchField';
import { useAllReceipts } from '../hooks/useAllReceipts';
import { showActionSheet } from '../lib/actionSheet';
import { aggregateFirms } from '../lib/firms';
import { formatTL, shortTrDate } from '../lib/format';
import { haptics } from '../lib/haptics';
import { normalizeForSearch } from '../lib/search';
import { useTheme } from '../lib/theme';

const SORTS = [
  { key: 'total', label: 'En Çok Harcanan' },
  { key: 'count', label: 'En Çok Fiş' },
  { key: 'recent', label: 'En Son Fiş' },
  { key: 'name', label: 'Ada Göre' },
] as const;
type FirmSort = (typeof SORTS)[number]['key'];

/** Fiş girilen tüm firmalar: toplam harcama ve fiş sayısıyla; dokununca firma detayı. */
export default function FirmsScreen() {
  const theme = useTheme();
  const { receipts, error, loading, refresh } = useAllReceipts();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<FirmSort>('total');
  const [pulling, setPulling] = useState(false);

  const firms = useMemo(() => aggregateFirms(receipts ?? []), [receipts]);
  const shown = useMemo(() => {
    const q = normalizeForSearch(query);
    const list = q ? firms.filter((f) => normalizeForSearch(f.name).includes(q)) : [...firms];
    if (sort === 'count') list.sort((a, b) => b.count - a.count || b.total - a.total);
    else if (sort === 'recent') list.sort((a, b) => b.last.localeCompare(a.last) || b.total - a.total);
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return list;
  }, [firms, query, sort]);

  function chooseSort() {
    showActionSheet({
      title: 'Sırala',
      options: SORTS.map((o) => ({
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
          <ListRow title={receipts ? 'Çevrimdışı · son veriler gösteriliyor' : 'Firmalar alınamadı'} subtitle={error} tone="action" onPress={refresh} />
        </ListSection>
      )}
      {firms.length === 0 && receipts ? (
        <EmptyState icon={{ sf: 'building.2', ion: 'business-outline' }} title="Firma Yok" message="Fiş ekledikçe firmalar burada listelenir." />
      ) : (
        <>
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Firma ara" />
          </View>
          <ListSection
            header={`Firmalar · ${shown.length}`}
            headerAction={{ label: SORTS.find((o) => o.key === sort)!.label, onPress: chooseSort, accessibilityLabel: 'Sıralamayı değiştir' }}
            footer="Büyük/küçük harf farkıyla yazılmış adlar tek satırda gösterilir. Farklı yazımları kalıcı olarak birleştirmek için Ayarlar → Firma Adlarını Birleştir.">
            {shown.length === 0 ? (
              <ListRow title="Eşleşen firma yok" disabled />
            ) : (
              shown.map((f) => (
                <ListRow
                  key={f.key}
                  title={f.name}
                  subtitle={`${f.count} fiş · son ${shortTrDate(f.last)}`}
                  value={formatTL(f.total)}
                  valueColor={theme.label}
                  chevron
                  onPress={() => router.push({ pathname: '/firm/[key]', params: { key: f.key } })}
                />
              ))
            )}
          </ListSection>
        </>
      )}
    </ScrollView>
  );
}
