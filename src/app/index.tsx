import { errorMessage } from '../lib/errors';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { router, Stack } from 'expo-router';
import { cloneElement, type ReactElement, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { HeaderIconButton } from '../components/ui/HeaderButton';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { ListRow, ListSection } from '../components/ui/List';
import { SearchField } from '../components/ui/SearchField';
import { TrendChart } from '../components/TrendChart';
import { Toolbar, useToolbarHeight } from '../components/ui/Toolbar';
import { useDrafts } from '../hooks/useDrafts';
import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { showAlert } from '../lib/alert';
import { formatTL } from '../lib/format';
import { haptics } from '../lib/haptics';
import { periodRange } from '../lib/period';
import { matchesReceipt } from '../lib/search';
import { formatRunAt } from '../lib/schedule';
import { compareWithPreviousMonth } from '../lib/trend';
import { categoryMeta, tabular, type Theme, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { VERSION_LABEL } from '../lib/version';
import { reloadApp, useWebUpdateAvailable } from '../lib/webUpdate';
import { buildAccountingPackage } from '../services/export/exportPackage';
import { buildReceiptsWorkbook, exportFilename, shareXlsx, shareZip } from '../services/export/exportReceipts';
import type { Kategori, ReceiptRecord } from '../types/receipt';

const PAGE = 25;

export default function DashboardScreen() {
  const theme = useTheme();
  const toolbarHeight = useToolbarHeight();
  const { summary: s, trend, loading, error, refresh, remove, period, label, showMonthly, showYearly, showAll, prev, next, goToMonth } =
    useMonthlySummary();
  const { drafts, processor } = useDrafts();
  const updateAvailable = useWebUpdateAvailable();
  const [visible, setVisible] = useState(PAGE);
  // Yenileme göstergesi yalnızca kullanıcı aşağı çektiğinde görünür; arka plan yenilemeleri
  // (ekrana her dönüşte) göstergeyi tetiklerse iOS sayfayı aşağı kaydırıp geri çıkarır.
  const [pulling, setPulling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [packing, setPacking] = useState<{ done: number; total: number } | null>(null);
  const isMonth = period.mode === 'month';
  const offset = period.mode === 'all' ? 0 : period.offset;
  const range = periodRange(period);

  // Dönem değişince listeyi baştan göster (React'in önerdiği: efekt yerine render sırasında)
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Kategori | null>(null);
  const listKey = `${label}|${query}|${category}`;
  const [shownKey, setShownKey] = useState(listKey);
  if (shownKey !== listKey) {
    setShownKey(listKey);
    setVisible(PAGE);
  }
  const filtering = !!query.trim() || !!category;
  const filtered = s?.fisler.filter((r) => (!category || r.kategori === category) && matchesReceipt(r, query)) ?? [];

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

  async function exportPackage() {
    if (!s || packing) return;
    setPacking({ done: 0, total: 0 });
    try {
      const { bytes, failed } = await buildAccountingPackage(s, capitalize(label), exportFilename(range), (done, total) => setPacking({ done, total }));
      await shareZip(bytes, exportFilename(range, 'zip'));
      if (failed) showToast(`${failed} fotoğraf indirilemedi; paket onlarsız oluşturuldu`, 'error', 4000);
      else haptics.success();
    } catch (e) {
      showAlert('Paket oluşturulamadı', errorMessage(e));
    } finally {
      setPacking(null);
    }
  }

  async function exportExcel() {
    if (!s || exporting) return;
    setExporting(true);
    try {
      await shareXlsx(buildReceiptsWorkbook(s, capitalize(label)), exportFilename(range));
      haptics.success();
    } catch (e) {
      showAlert('Dışa aktarılamadı', errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  const total = s?.kategoriToplamlari.reduce((a, k) => a + k.toplam, 0) ?? 0;

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
        <View style={styles.controls}>
          <SegmentedControl
            values={['Aylık', 'Yıllık', 'Tüm Zamanlar']}
            selectedIndex={period.mode === 'month' ? 0 : period.mode === 'year' ? 1 : 2}
            onChange={(e) => {
              haptics.select();
              [showMonthly, showYearly, showAll][e.nativeEvent.selectedSegmentIndex]?.();
            }}
            appearance={theme.dark ? 'dark' : 'light'}
          />
          {range && (
            <View style={styles.monthRow}>
              <ChevronButton dir="left" onPress={prev} theme={theme} label={isMonth ? 'Önceki ay' : 'Önceki yıl'} />
              <Text style={[t.headline, { color: theme.label }]}>{capitalize(label)}</Text>
              <ChevronButton dir="right" onPress={next} disabled={offset === 0} theme={theme} label={isMonth ? 'Sonraki ay' : 'Sonraki yıl'} />
            </View>
          )}
        </View>

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

        {error && (
          <ListSection>
            <ListRow title="Veriler alınamadı" subtitle={error} icon={{ sf: 'wifi.exclamationmark', ion: 'cloud-offline', color: theme.orange }} onPress={refresh} chevron />
          </ListSection>
        )}

        {!s && loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} />
        ) : (
          <>
            <SummaryCard
              theme={theme}
              total={s?.toplamGider ?? 0}
              kdv={s?.toplamKdv ?? 0}
              count={s?.fisSayisi ?? 0}
              compare={isMonth ? compareWithPreviousMonth(trend, offset, s?.toplamGider ?? 0) : null}
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
                  <ListSection footer="Muhasebecinize e-posta, WhatsApp ya da Dosyalar ile gönderebilirsiniz.">
                    <ListRow
                      title="Excel'e Aktar"
                      subtitle={`${capitalize(label)} · ${s.fisSayisi} fiş`}
                      icon={{ sf: 'tablecells.fill', ion: 'grid', color: theme.green }}
                      onPress={exportExcel}
                      disabled={exporting}
                      accessory={exporting ? <ActivityIndicator /> : undefined}
                      chevron={!exporting}
                    />
                    <ListRow
                      title="Muhasebe Paketi (ZIP)"
                      subtitle={
                        packing
                          ? packing.total
                            ? `Fotoğraflar indiriliyor ${packing.done}/${packing.total}`
                            : 'Hazırlanıyor…'
                          : `Excel + ${s.fisler.filter((r) => r.image_path).length} fiş fotoğrafı`
                      }
                      icon={{ sf: 'archivebox.fill', ion: 'archive', color: theme.orange }}
                      onPress={exportPackage}
                      disabled={!!packing}
                      accessory={packing ? <ActivityIndicator /> : undefined}
                      chevron={!packing}
                    />
                  </ListSection>

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

                  <ListSection header="Kategoriler">
                    <CategoryBar items={s.kategoriToplamlari} theme={theme} />
                    {s.kategoriToplamlari.map((k) => {
                      const meta = categoryMeta[k.kategori];
                      return (
                        <ListRow
                          key={k.kategori}
                          icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
                          title={meta.label}
                          value={`${formatTL(k.toplam)}  ·  %${total ? Math.round((k.toplam / total) * 100) : 0}`}
                          onPress={() => {
                            haptics.select();
                            setCategory((c) => (c === k.kategori ? null : k.kategori));
                          }}
                          accessory={
                            <View style={{ width: 18, alignItems: 'flex-end' }}>
                              {category === k.kategori && <Icon sf="checkmark" ion="checkmark" size={16} color={theme.blue} weight="semibold" />}
                            </View>
                          }
                        />
                      );
                    })}
                  </ListSection>

                  {Platform.OS !== 'ios' && (
                    <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                      <SearchField value={query} onChangeText={setQuery} placeholder="Firma ya da tutar ara" />
                    </View>
                  )}
                  <ListSection
                    header={filtering ? `Fişler · ${filtered.length} / ${s.fisler.length}` : `Fişler · ${s.fisler.length}`}
                    footer={category ? `Yalnızca ${categoryMeta[category].label} kategorisi gösteriliyor. Kategoriye tekrar dokunarak filtreyi kaldırabilirsiniz.` : undefined}>
                    {[
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
                      ...filtered.slice(0, visible).map((r) => (
                        <SwipeToDelete key={r.id} onDelete={() => deleteReceipt(r)} theme={theme}>
                          <ReceiptRow receipt={r} theme={theme} onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })} />
                        </SwipeToDelete>
                      )),
                      ...(filtered.length > visible
                        ? [<ListRow key="more" title={`${filtered.length - visible} fiş daha göster`} tone="action" onPress={() => setVisible((v) => v + PAGE)} />]
                        : []),
                    ]}
                  </ListSection>
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
        <Button title="Fiş Tara" icon={{ sf: 'camera.fill', ion: 'camera' }} onPress={() => router.push('/camera')} />
      </Toolbar>
    </View>
  );
}

type Compare = ReturnType<typeof compareWithPreviousMonth>;

function SummaryCard({ theme, total, kdv, count, compare }: { theme: Theme; total: number; kdv: number; count: number; compare: Compare }) {
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
      <View style={[styles.hr, { backgroundColor: theme.separator }]} />
      <View style={styles.stats}>
        <Stat label="KDV Alacağı" value={formatTL(kdv)} color={theme.green} theme={theme} />
        <View style={[styles.vr, { backgroundColor: theme.separator }]} />
        <Stat label="KDV Hariç" value={formatTL(total - kdv)} color={theme.label} theme={theme} />
      </View>
    </View>
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

function ReceiptRow({ receipt: r, theme, onPress, isLast }: { receipt: ReceiptRecord; theme: Theme; onPress: () => void; isLast?: boolean }) {
  const meta = categoryMeta[r.kategori] ?? categoryMeta['ofis gideri'];
  return (
    <ListRow
      icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
      title={r.firma_adi}
      subtitle={`${shortDate(r.tarih)} · KDV ${formatTL(r.toplam_kdv)}`}
      value={formatTL(r.toplam_tutar)}
      valueColor={theme.label}
      chevron
      onPress={onPress}
      isLast={isLast}
    />
  );
}

/** Sola kaydırınca kırmızı "Sil" düğmesi (iOS listeleri gibi) */
function SwipeToDelete({ children, onDelete, theme, isLast }: { children: ReactElement<{ isLast?: boolean }>; onDelete: () => void; theme: Theme; isLast?: boolean }) {
  return (
    <ReanimatedSwipeable
      friction={1.5}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onDelete} style={[styles.swipeDelete, { backgroundColor: theme.red }]} accessibilityLabel="Sil">
          <Icon sf="trash.fill" ion="trash" size={20} color="#fff" />
          <Text style={styles.swipeText}>Sil</Text>
        </Pressable>
      )}>
      <View style={{ backgroundColor: theme.card }}>{cloneElement(children, { isLast })}</View>
    </ReanimatedSwipeable>
  );
}

/** Depolama göstergesi gibi, kategorilerin payını gösteren tek şerit */
function CategoryBar({ items, theme }: { items: { kategori: ReceiptRecord['kategori']; toplam: number }[]; theme: Theme; isLast?: boolean }) {
  return (
    <View style={styles.barWrap}>
      <View style={[styles.bar, { backgroundColor: theme.tertiaryFill }]}>
        {items.map((k) => (
          <View key={k.kategori} style={{ flex: k.toplam, backgroundColor: theme[categoryMeta[k.kategori].color] as string }} />
        ))}
      </View>
    </View>
  );
}

function ChevronButton({ dir, onPress, disabled, theme, label }: { dir: 'left' | 'right'; onPress: () => void; disabled?: boolean; theme: Theme; label: string }) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => ({ opacity: disabled ? 0.25 : pressed ? 0.5 : 1, padding: 6 })}>
      <Icon sf={`chevron.${dir}`} ion={dir === 'left' ? 'chevron-back' : 'chevron-forward'} size={18} color={theme.blue} weight="semibold" />
    </Pressable>
  );
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function capitalize(s: string) {
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
}

const styles = StyleSheet.create({
  controls: { marginHorizontal: 16, marginBottom: 16, gap: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { marginHorizontal: 16, marginBottom: 28, borderRadius: 12, padding: 16, gap: 2 },
  bigNumber: { fontSize: 40, lineHeight: 46, fontWeight: '700', letterSpacing: -0.5 },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  vr: { width: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  stats: { flexDirection: 'row' },
  barWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  bar: { height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  swipeDelete: { width: 84, alignItems: 'center', justifyContent: 'center', gap: 2 },
  swipeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
