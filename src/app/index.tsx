import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';

import { CategorySection } from '../components/dashboard/CategorySection';
import { ExportSection } from '../components/dashboard/ExportSection';
import { PeriodPicker } from '../components/dashboard/PeriodPicker';
import { ReceiptRow, SwipeToDelete } from '../components/dashboard/ReceiptRow';
import { SummaryCard } from '../components/dashboard/SummaryCard';
import { TrendChart } from '../components/TrendChart';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { HeaderIconButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { SearchField } from '../components/ui/SearchField';
import { Toolbar, useToolbarHeight } from '../components/ui/Toolbar';
import { useDrafts } from '../hooks/useDrafts';
import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { formatTL } from '../lib/format';
import { haptics } from '../lib/haptics';
import { periodRange } from '../lib/period';
import { formatRunAt } from '../lib/schedule';
import { matchesReceipt } from '../lib/search';
import { groupByMonth, SORT_OPTIONS, type SortKey, sortReceipts } from '../lib/sort';
import { useMonthlyBudget } from '../lib/budget';
import { categoryMeta, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { compareWithPreviousMonth } from '../lib/trend';
import { VERSION_LABEL } from '../lib/version';
import { reloadApp, useWebUpdateAvailable } from '../lib/webUpdate';
import { categoriesReady } from '../services/supabase/schema';
import type { Kategori, ReceiptRecord } from '../types/receipt';

const PAGE = 25;

export default function DashboardScreen() {
  const theme = useTheme();
  const toolbarHeight = useToolbarHeight();
  const { summary: s, trend, loading, error, offlineSince, refresh, remove, period, label, showMonthly, showYearly, showAll, prev, next, goToMonth } =
    useMonthlySummary();
  const { drafts, processor } = useDrafts();
  const updateAvailable = useWebUpdateAvailable();
  const budget = useMonthlyBudget();
  // Yeni kategoriler için veritabanı kurulumu (003) yapılmadıysa üstte hatırlat
  const [needsCategorySetup, setNeedsCategorySetup] = useState(false);
  useEffect(() => {
    if (!s) return;
    categoriesReady().then((ready) => setNeedsCategorySetup(ready === false));
  }, [s]);
  const [visible, setVisible] = useState(PAGE);
  // Yenileme göstergesi yalnızca kullanıcı aşağı çektiğinde görünür; arka plan yenilemeleri
  // (ekrana her dönüşte) göstergeyi tetiklerse iOS sayfayı aşağı kaydırıp geri çıkarır.
  const [pulling, setPulling] = useState(false);
  const isMonth = period.mode === 'month';
  const offset = period.mode === 'all' ? 0 : period.offset;
  const range = periodRange(period);

  // Dönem değişince listeyi baştan göster (React'in önerdiği: efekt yerine render sırasında)
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Kategori | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');
  const listKey = `${label}|${query}|${category}|${sort}`;
  const [shownKey, setShownKey] = useState(listKey);
  if (shownKey !== listKey) {
    setShownKey(listKey);
    setVisible(PAGE);
  }
  const filtering = !!query.trim() || !!category;
  const filtered = sortReceipts(s?.fisler.filter((r) => (!category || r.kategori === category) && matchesReceipt(r, query)) ?? [], sort);

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

  const readyDrafts = drafts.filter((d) => d.status === 'ready').length;
  const nextScheduled = drafts.find((d) => d.status === 'scheduled' && d.scheduled_for)?.scheduled_for;


  async function deleteReceipt(r: ReceiptRecord) {
    try {
      await remove(r);
      haptics.success();
      showToast('Fiş silindi', 'info');
    } catch (e) {
      showAlert('Silinemedi', errorMessage(e));
    }
  }

  const shown = filtered.slice(0, visible);
  // Yıllık / tüm zamanlar görünümünde, tarihe göre sıralıyken fişleri aylara ayır
  const grouped = period.mode !== 'month' && (sort === 'newest' || sort === 'oldest') ? groupByMonth(shown) : null;
  const monthTotals = new Map<string, { count: number; total: number }>();
  if (grouped) {
    for (const r of filtered) {
      const key = r.tarih.slice(0, 7);
      const m = monthTotals.get(key) ?? { count: 0, total: 0 };
      m.count += 1;
      m.total += r.toplam_tutar;
      monthTotals.set(key, m);
    }
  }
  const categoryFooter = category
    ? `Yalnızca ${categoryMeta[category].label} kategorisi gösteriliyor. Kategoriye tekrar dokunarak filtreyi kaldırabilirsiniz.`
    : undefined;
  const controlRows = [
    ...(filtering
      ? [
          <ListRow
            key="clear"
            title="Filtreyi Temizle"
            tone="action"
            icon={{ sf: 'line.3.horizontal.decrease.circle.fill', ion: 'filter-circle', color: theme.blue }}
            onPress={() => {
              setQuery('');
              setCategory(null);
            }}
          />,
        ]
      : []),
    ...(filtering && filtered.length === 0 ? [<ListRow key="none" title="Eşleşen fiş yok" disabled />] : []),
    ...(filtering && filtered.length === 0 && period.mode !== 'all'
      ? [
          <ListRow
            key="all"
            title="Tüm Zamanlarda Ara"
            tone="action"
            icon={{ sf: 'magnifyingglass.circle.fill', ion: 'search-circle', color: theme.blue }}
            onPress={showAll}
          />,
        ]
      : []),
  ];
  const receiptRow = (r: ReceiptRecord) => (
    <SwipeToDelete key={r.id} onDelete={() => deleteReceipt(r)}>
      <ReceiptRow receipt={r} onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })} />
    </SwipeToDelete>
  );
  const moreRow =
    filtered.length > visible ? <ListRow key="more" title={`${filtered.length - visible} fiş daha göster`} tone="action" onPress={() => setVisible((v) => v + PAGE)} /> : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderIconButton icon={{ sf: 'person.crop.circle', ion: 'person-circle-outline' }} onPress={() => router.push('/settings')} label="Ayarlar" />,
          headerRight: () => (
            <HeaderIconButton
              icon={{ sf: 'square.stack.3d.up', ion: 'layers-outline' }}
              onPress={() => router.push('/batch')}
              badge={readyDrafts || undefined}
              label="Toplu tarama"
            />
          ),
          // iOS: büyük başlığın altında sistem arama çubuğu (Mail/Notlar gibi)
          ...(Platform.OS === 'ios'
            ? {
                headerSearchBarOptions: {
                  placeholder: 'Firma ya da tutar ara',
                  // iOS 26 arama çubuğunu varsayılan olarak alta taşıyor ve "Fiş Tara" çubuğunun üstüne biniyor;
                  // başlığın altında (klasik yerinde) sabit kalsın
                  placement: 'stacked' as const,
                  allowToolbarIntegration: false,
                  cancelButtonText: 'Vazgeç',
                  autoCapitalize: 'none' as const,
                  hideWhenScrolling: true,
                  obscureBackground: false,
                  onChangeText: (e: { nativeEvent: { text: string } }) => setQuery(e.nativeEvent.text),
                  onCancelButtonPress: () => setQuery(''),
                },
              }
            : {}),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: toolbarHeight }}
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
        <PeriodPicker
          period={period}
          label={label}
          onMode={(mode) => ({ month: showMonthly, year: showYearly, all: showAll })[mode]()}
          onPrev={prev}
          onNext={next}
        />

        {updateAvailable && (
          <ListSection>
            <ListRow
              title="Yeni sürüm hazır"
              subtitle="Güncellemek için dokunun"
              icon={{ sf: 'arrow.down.circle.fill', ion: 'arrow-down-circle', color: theme.blue }}
              onPress={reloadApp}
              chevron
            />
          </ListSection>
        )}

        {needsCategorySetup && (
          <ListSection>
            <ListRow
              title="Yeni kategorileri etkinleştir"
              subtitle="Ulaşım, Faturalar, Giyim ve fazlası"
              icon={{ sf: 'tag.fill', ion: 'pricetag', color: theme.purple }}
              onPress={() => router.push('/setup-categories')}
              chevron
            />
          </ListSection>
        )}

        {error && (
          <ListSection>
            <ListRow
              title={offlineSince ? 'Çevrimdışı' : 'Veriler alınamadı'}
              subtitle={offlineSince ? `Son veriler · ${formatSavedAt(offlineSince)}` : error}
              icon={{ sf: 'wifi.exclamationmark', ion: 'cloud-offline', color: theme.orange }}
              onPress={refresh}
              chevron
            />
          </ListSection>
        )}

        {!s && loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} />
        ) : (
          <>
            <SummaryCard
              total={s?.toplamGider ?? 0}
              kdv={s?.toplamKdv ?? 0}
              count={s?.fisSayisi ?? 0}
              compare={isMonth ? compareWithPreviousMonth(trend, offset, s?.toplamGider ?? 0) : null}
              budget={isMonth ? budget : null}
              onBudgetPress={() => router.push('/budget')}
            />

            {(drafts.length > 0 || processor.running) && (
              <ListSection>
                <ListRow
                  icon={{ sf: 'square.stack.3d.up.fill', ion: 'layers', color: theme.purple }}
                  title={processor.running ? `Taranıyor ${processor.done}/${processor.total}` : 'Taslaklar'}
                  subtitle={
                    readyDrafts
                      ? `${readyDrafts} fiş incelemeye hazır`
                      : nextScheduled
                        ? `${formatRunAt(nextScheduled)} için planlı`
                        : 'Taranmayı bekliyor'
                  }
                  value={String(drafts.length)}
                  chevron
                  onPress={() => router.push('/batch')}
                />
              </ListSection>
            )}

            {s && s.fisSayisi === 0 ? (
              <EmptyState
                icon={{ sf: 'doc.text.viewfinder', ion: 'scan-outline' }}
                title="Fiş Yok"
                message={range ? `${isMonth ? 'Bu ay' : 'Bu yıl'} tarihli bir fiş bulunmuyor. Taramak için aşağıdaki düğmeyi kullanın.` : 'Henüz hiç fiş kaydetmediniz.'}
              />
            ) : (
              s && (
                <>
                  <ExportSection summary={s} label={label} range={range} />

                  {trend && trend.some((p) => p.total > 0) && (
                    <ListSection header="Son 12 Ay">
                      <TrendChart
                        key={`${period.mode}${offset}`}
                        data={trend}
                        currentOffset={isMonth ? offset : null}
                        onOpenMonth={goToMonth}
                      />
                    </ListSection>
                  )}

                  <ListSection header="KDV Dağılımı">
                    <ListRow title="%1" value={formatTL(s.kdv1)} />
                    <ListRow title="%10" value={formatTL(s.kdv10)} />
                    <ListRow title="%20" value={formatTL(s.kdv20)} />
                  </ListSection>

                  <CategorySection items={s.kategoriToplamlari} selected={category} onSelect={setCategory} />

                  {Platform.OS !== 'ios' && (
                    <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                      <SearchField value={query} onChangeText={setQuery} placeholder="Firma ya da tutar ara" />
                    </View>
                  )}
                  <ListSection
                    header={filtering ? `Fişler · ${filtered.length} / ${s.fisler.length}` : `Fişler · ${s.fisler.length}`}
                    headerAction={
                      s.fisler.length > 1
                        ? { label: SORT_OPTIONS.find((o) => o.key === sort)!.label, onPress: chooseSort, accessibilityLabel: 'Sıralamayı değiştir' }
                        : undefined
                    }
                    style={grouped && controlRows.length === 0 ? { marginBottom: 12 } : undefined}
                    footer={grouped ? undefined : categoryFooter}>
                    {[...controlRows, ...(grouped ? [] : shown.map(receiptRow)), ...(!grouped && moreRow ? [moreRow] : [])]}
                  </ListSection>
                  {grouped?.map((g, i) => {
                    const m = monthTotals.get(g.key);
                    const last = i === grouped.length - 1;
                    return (
                      <ListSection key={g.key} header={`${g.label} · ${m?.count ?? g.items.length} fiş · ${formatTL(m?.total ?? 0)}`} footer={last ? categoryFooter : undefined}>
                        {[...g.items.map(receiptRow), ...(last && moreRow ? [moreRow] : [])]}
                      </ListSection>
                    );
                  })}
                </>
              )
            )}
          </>
        )}

        <Text style={[t.caption1, { color: theme.tertiaryLabel, textAlign: 'center' }]}>
          Sürüm {VERSION_LABEL}
        </Text>
      </ScrollView>

      <Toolbar>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            title="Elle"
            variant="gray"
            icon={{ sf: 'square.and.pencil', ion: 'create-outline' }}
            onPress={() => router.push('/manual')}
            style={{ paddingHorizontal: 18 }}
          />
          <Button title="Fiş Tara" icon={{ sf: 'camera.fill', ion: 'camera' }} onPress={() => router.push('/camera')} style={{ flex: 1 }} />
        </View>
      </Toolbar>
    </View>
  );
}

function formatSavedAt(ms: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? `bugün ${time}` : `${d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${time}`;
}
