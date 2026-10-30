import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '../components/ui/EmptyState';
import { ListRow, ListSection } from '../components/ui/List';
import { SearchField } from '../components/ui/SearchField';
import { Badge } from '../components/web/Badge';
import { WebButton } from '../components/web/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/web/Card';
import { WebInput } from '../components/web/Input';
import { WebPageHeader } from '../components/web/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/web/Table';
import { useAllReceipts } from '../hooks/useAllReceipts';
import { showActionSheet } from '../lib/actionSheet';
import { aggregateFirms, firmKeyToParam } from '../lib/firms';
import { formatTL, shortTrDate } from '../lib/format';
import { haptics } from '../lib/haptics';
import { useWide } from '../lib/layout';
import { normalizeForSearch } from '../lib/search';
import { fontFamily, tabular, useShadcnTheme, useTheme } from '../lib/theme';

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
  const wide = useWide();
  const st = useShadcnTheme();
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

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 1050, width: '100%', gap: 24 }}>
            <WebPageHeader
              title="Firmalar"
              description={`${shown.length} firma listeleniyor · Toplam harcama tutarları ve fiş sayıları.`}
              onBack={() => router.back()}
              actions={
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {SORTS.map((o) => (
                    <WebButton
                      key={o.key}
                      variant={sort === o.key ? 'default' : 'outline'}
                      size="sm"
                      onPress={() => {
                        haptics.select();
                        setSort(o.key);
                      }}>
                      {o.label}
                    </WebButton>
                  ))}
                </View>
              }
            />

            <View style={{ width: '100%', maxWidth: 450 }}>
              <WebInput
                value={query}
                onChangeText={setQuery}
                onClear={() => setQuery('')}
                placeholder="Firma adına göre ara..."
                icon={{ sf: 'magnifyingglass', ion: 'search' }}
              />
            </View>

            {error && (
              <Card style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#991b1b' }}>Firmalar Alınamadı</CardTitle>
                  <CardDescription style={{ color: '#b91c1c' }}>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                  <WebButton variant="outline" onPress={refresh}>
                    Tekrar Dene
                  </WebButton>
                </CardContent>
              </Card>
            )}

            {firms.length === 0 && receipts ? (
              <EmptyState icon={{ sf: 'building.2', ion: 'business-outline' }} title="Firma Yok" message="Fiş ekledikçe firmalar burada listelenir." />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Firma Listesi ({shown.length})</CardTitle>
                  <CardDescription>
                    Büyük/küçük harf farkıyla yazılmış adlar tek satırda birleştirilerek gösterilir.
                  </CardDescription>
                </CardHeader>
                <CardContent style={{ padding: 0 }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ flex: 3 }}>Firma Adı</TableHead>
                        <TableHead style={{ flex: 1.2 }}>Fiş Adedi</TableHead>
                        <TableHead style={{ flex: 1.5 }}>Son Fiş Tarihi</TableHead>
                        <TableHead style={{ flex: 1.8 }} align="right">Toplam Harcama</TableHead>
                        <TableHead style={{ flex: 1.2 }} align="right">İşlem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.length === 0 ? (
                        <TableRow>
                          <TableCell style={{ flex: 1, paddingVertical: 24, alignItems: 'center' }}>
                            <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>
                              Arama kriterlerine uygun firma bulunamadı.
                            </Text>
                          </TableCell>
                        </TableRow>
                      ) : (
                        shown.map((f) => (
                          <TableRow
                            key={f.key}
                            onPress={() => router.push({ pathname: '/firm/[key]', params: { key: firmKeyToParam(f.key) } })}>
                            <TableCell style={{ flex: 3 }}>
                              <Text style={{ fontFamily, fontSize: 13, fontWeight: '600', color: st.cardForeground }}>
                                {f.name}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.2 }}>
                              <Badge variant="secondary" style={tabular}>
                                {f.count} fiş
                              </Badge>
                            </TableCell>
                            <TableCell style={{ flex: 1.5 }}>
                              <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                {shortTrDate(f.last)}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.8, alignItems: 'flex-end' }}>
                              <Text style={[{ fontFamily, fontSize: 14, fontWeight: '700', color: st.cardForeground }, tabular]}>
                                {formatTL(f.total)}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.2, alignItems: 'flex-end' }}>
                              <WebButton
                                variant="ghost"
                                size="sm"
                                icon={{ sf: 'chevron.right', ion: 'arrow-forward' }}
                                onPress={() => router.push({ pathname: '/firm/[key]', params: { key: firmKeyToParam(f.key) } })}>
                                Detay
                              </WebButton>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

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
                  onPress={() => router.push({ pathname: '/firm/[key]', params: { key: firmKeyToParam(f.key) } })}
                />
              ))
            )}
          </ListSection>
        </>
      )}
    </ScrollView>
  );
}
