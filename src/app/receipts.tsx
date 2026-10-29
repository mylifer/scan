import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Switch, View } from 'react-native';

import { SummaryCard } from '../components/dashboard/SummaryCard';
import { ReceiptList } from '../components/ReceiptList';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { HeaderTextButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { SearchField } from '../components/ui/SearchField';
import { Toolbar, useToolbarHeight } from '../components/ui/Toolbar';
import { useAllReceipts } from '../hooks/useAllReceipts';
import { showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { showSentSheet } from '../lib/bulkSent';
import { errorMessage } from '../lib/errors';
import { round2 } from '../lib/format';
import { haptics } from '../lib/haptics';
import { receiptMatcher } from '../lib/search';
import { SORT_OPTIONS, type SortKey, sortReceipts } from '../lib/sort';
import { useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';

/** Bugüne kadar girilen tüm fişler: arama, sıralama, aylara göre gruplu liste; seçip toplu "gönderildi" işaretleme. */
export default function AllReceiptsScreen() {
  const theme = useTheme();
  const toolbarHeight = useToolbarHeight();
  const { receipts, error, loading, refresh } = useAllReceipts();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [pulling, setPulling] = useState(false);
  const [unsentOnly, setUnsentOnly] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const sentCount = useMemo(() => (receipts ?? []).filter((r) => r.muhasebe_gonderildi_at).length, [receipts]);
  const filtered = useMemo(() => {
    const matches = receiptMatcher(query);
    return sortReceipts((receipts ?? []).filter((r) => (!unsentOnly || !r.muhasebe_gonderildi_at) && matches(r)), sort);
  }, [receipts, query, sort, unsentOnly]);
  const totals = useMemo(
    () => ({
      total: round2(filtered.reduce((a, r) => a + r.toplam_tutar, 0)),
      kdv: round2(filtered.reduce((a, r) => a + r.toplam_kdv, 0)),
    }),
    [filtered],
  );
  // "Tümünü Seç": arama/filtreye uyan bütün fişler (henüz "daha göster" ile açılmamış olanlar da)
  const selectedList = useMemo(() => filtered.filter((r) => selected.has(r.id)), [filtered, selected]);
  const allSelected = filtered.length > 0 && selectedList.length === filtered.length;

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

  function toggle(id: string) {
    haptics.select();
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
  }

  async function run(task: () => Promise<string>) {
    setBusy(true);
    try {
      const message = await task();
      haptics.success();
      exitSelection();
      await refresh();
      showToast(message, 'info');
    } catch (e) {
      haptics.error();
      showAlert('İşlem tamamlanamadı', errorMessage(e));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!receipts && loading) return <ActivityIndicator style={{ marginTop: 48 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerLeft: selecting
            ? () => (
                <HeaderTextButton
                  title={allSelected ? 'Seçimi Kaldır' : `Tümünü Seç (${filtered.length})`}
                  onPress={() => setSelected(allSelected ? new Set() : new Set(filtered.map((r) => r.id)))}
                />
              )
            : undefined,
          headerRight: () =>
            selecting ? (
              <HeaderTextButton title="Bitti" bold onPress={exitSelection} />
            ) : receipts?.length ? (
              <HeaderTextButton title="Seç" onPress={() => setSelecting(true)} />
            ) : null,
        }}
      />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: selecting ? toolbarHeight : 40 }}
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
              <SearchField value={query} onChangeText={setQuery} placeholder="Firma, tutar, etiket ya da not ara" />
            </View>
            {sentCount > 0 || unsentOnly ? (
              <ListSection>
                <ListRow
                  title="Yalnızca Gönderilmemişler"
                  subtitle={`${sentCount} fiş muhasebeciye gönderildi`}
                  icon={{ sf: 'paperplane', ion: 'paper-plane-outline', color: theme.green }}
                  accessory={<Switch value={unsentOnly} onValueChange={setUnsentOnly} accessibilityLabel="Yalnızca gönderilmemişler" />}
                />
              </ListSection>
            ) : null}
            {filtered.length === 0 ? (
              <ListSection>
                <ListRow title="Eşleşen fiş yok" disabled />
              </ListSection>
            ) : (
              <ReceiptList
                key={`${query}|${sort}|${unsentOnly}`}
                receipts={filtered}
                sort={sort}
                header={`Fişler · ${filtered.length}`}
                headerAction={{ label: SORT_OPTIONS.find((o) => o.key === sort)!.label, onPress: chooseSort, accessibilityLabel: 'Sıralamayı değiştir' }}
                selection={selecting ? { selected, toggle } : undefined}
              />
            )}
          </>
        )}
      </ScrollView>
      {selecting && (
        <Toolbar>
          <Button
            title={selectedList.length ? `Gönderildi (${selectedList.length})` : 'Gönderildi'}
            icon={{ sf: 'paperplane.fill', ion: 'paper-plane' }}
            onPress={() => showSentSheet(selectedList, run)}
            loading={busy}
            disabled={!selectedList.length || busy}
          />
        </Toolbar>
      )}
    </View>
  );
}
