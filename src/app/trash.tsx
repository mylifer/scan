import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '../components/ui/EmptyState';
import { HeaderTextButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { Badge } from '../components/web/Badge';
import { WebButton } from '../components/web/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/web/Card';
import { WebPageHeader } from '../components/web/PageHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/web/Table';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { confirmDestructive, showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { formatTL, shortTrDate } from '../lib/format';
import { haptics } from '../lib/haptics';
import { useWide } from '../lib/layout';
import { categoryMeta, fontFamily, tabular, useShadcnTheme, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { TRASH_DAYS, trashDaysLeft, trashLeftLabel } from '../lib/trash';
import { listTrash, purgeTrash, restoreFromTrash, type TrashItem } from '../services/supabase/receiptsRepository';

/** Son Silinenler: silinen fişler 30 gün geri alınabilir. */
export default function TrashScreen() {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
  const runOnce = useSingleFlight();
  const [items, setItems] = useState<TrashItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listTrash());
    } catch (e) {
      showAlert('Son Silinenler alınamadı', errorMessage(e));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // load asenkron: durum yalnızca yanıt geldikten sonra güncellenir
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function act(item: TrashItem) {
    showActionSheet({
      title: item.receipt.firma_adi,
      message: `${formatTL(item.receipt.toplam_tutar)} · ${shortTrDate(item.receipt.tarih)}`,
      options: [
        {
          label: 'Geri Al',
          onPress: () =>
            runOnce(async () => {
              try {
                await restoreFromTrash(item);
                haptics.success();
                showToast('Fiş geri alındı');
                setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
              } catch (e) {
                showAlert('Geri alınamadı', errorMessage(e));
              }
            }),
        },
        {
          label: 'Kalıcı Olarak Sil',
          destructive: true,
          onPress: () =>
            confirmDestructive(item.receipt.firma_adi, 'Fiş ve fotoğrafı kalıcı olarak silinecek. Bu işlem geri alınamaz.', 'Kalıcı Olarak Sil', () =>
              runOnce(async () => {
                try {
                  await purgeTrash([item]);
                  setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
                } catch (e) {
                  showAlert('Silinemedi', errorMessage(e));
                }
              }),
            ),
        },
      ],
    });
  }

  function emptyAll() {
    if (!items?.length) return;
    confirmDestructive('Tümünü Sil', `${items.length} fiş ve fotoğrafları kalıcı olarak silinecek. Bu işlem geri alınamaz.`, 'Tümünü Kalıcı Olarak Sil', () =>
      runOnce(async () => {
        try {
          await purgeTrash(items);
          setItems([]);
        } catch (e) {
          showAlert('Silinemedi', errorMessage(e));
        }
      }),
    );
  }

  const header = <Stack.Screen options={{ headerRight: () => (items?.length ? <HeaderTextButton title="Tümünü Sil" onPress={emptyAll} /> : null) }} />;

  if (!items) return <ActivityIndicator style={{ marginTop: 48 }} />;

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center' }}>
        {header}
        <EmptyState icon={{ sf: 'trash', ion: 'trash-outline' }} title="Son Silinen Yok" message={`Sildiğiniz fişler ${TRASH_DAYS} gün boyunca burada durur ve geri alınabilir.`} />
      </View>
    );
  }

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 950, width: '100%', gap: 24 }}>
            <WebPageHeader
              title="Son Silinenler"
              description={`Sildiğiniz fişler ${TRASH_DAYS} gün boyunca burada saklanır ve dilediğiniz zaman geri yüklenebilir.`}
              onBack={() => router.back()}
              actions={
                items?.length ? (
                  <WebButton
                    variant="destructive"
                    icon={{ sf: 'trash.fill', ion: 'trash' }}
                    onPress={emptyAll}>
                    Tümünü Kalıcı Olarak Sil
                  </WebButton>
                ) : undefined
              }
            />

            {items.length === 0 ? (
              <EmptyState
                icon={{ sf: 'trash', ion: 'trash-outline' }}
                title="Son Silinen Yok"
                message={`Sildiğiniz fişler ${TRASH_DAYS} gün boyunca burada durur ve geri alınabilir.`}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Silinen Fişler ({items.length})</CardTitle>
                  <CardDescription>
                    Fişler silindikten {TRASH_DAYS} gün sonra fotoğraflarıyla birlikte otomatik ve kalıcı olarak temizlenir.
                  </CardDescription>
                </CardHeader>
                <CardContent style={{ padding: 0 }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ flex: 2.5 }}>Firma Adı</TableHead>
                        <TableHead style={{ flex: 1.5 }}>Kategori</TableHead>
                        <TableHead style={{ flex: 1.2 }}>Tarih</TableHead>
                        <TableHead style={{ flex: 1.5 }} align="right">Tutar</TableHead>
                        <TableHead style={{ flex: 1.4 }}>Kalan Süre</TableHead>
                        <TableHead style={{ flex: 1.8 }} align="right">İşlemler</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const r = item.receipt;
                        const meta = categoryMeta(r.kategori);
                        const daysLeft = trashDaysLeft(item.deleted_at);

                        return (
                          <TableRow key={item.id}>
                            <TableCell style={{ flex: 2.5 }}>
                              <Text style={{ fontFamily, fontSize: 13, fontWeight: '600', color: st.cardForeground }}>
                                {r.firma_adi}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.5 }}>
                              <Badge variant="outline">{meta.label}</Badge>
                            </TableCell>
                            <TableCell style={{ flex: 1.2 }}>
                              <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                {shortTrDate(r.tarih)}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.5, alignItems: 'flex-end' }}>
                              <Text style={[{ fontFamily, fontSize: 14, fontWeight: '700', color: st.cardForeground }, tabular]}>
                                {formatTL(r.toplam_tutar)}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.4 }}>
                              <Badge variant={daysLeft <= 3 ? 'destructive' : 'secondary'}>
                                {trashLeftLabel(daysLeft)}
                              </Badge>
                            </TableCell>
                            <TableCell style={{ flex: 1.8, alignItems: 'flex-end' }}>
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <WebButton
                                  variant="outline"
                                  size="sm"
                                  icon={{ sf: 'arrow.uturn.backward', ion: 'arrow-undo' }}
                                  onPress={() =>
                                    runOnce(async () => {
                                      try {
                                        await restoreFromTrash(item);
                                        haptics.success();
                                        showToast('Fiş geri alındı');
                                        setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
                                      } catch (e) {
                                        showAlert('Geri alınamadı', errorMessage(e));
                                      }
                                    })
                                  }>
                                  Geri Al
                                </WebButton>
                                <WebButton
                                  variant="ghost"
                                  size="sm"
                                  icon={{ sf: 'trash', ion: 'trash' }}
                                  onPress={() =>
                                    confirmDestructive(
                                      r.firma_adi,
                                      'Fiş ve fotoğrafı kalıcı olarak silinecek. Bu işlem geri alınamaz.',
                                      'Kalıcı Olarak Sil',
                                      () =>
                                        runOnce(async () => {
                                          try {
                                            await purgeTrash([item]);
                                            setItems((list) => list?.filter((i) => i.id !== item.id) ?? null);
                                          } catch (e) {
                                            showAlert('Silinemedi', errorMessage(e));
                                          }
                                        }),
                                    )
                                  }
                                />
                              </View>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      {header}
      <ListSection footer={`Fişler silindikten ${TRASH_DAYS} gün sonra fotoğraflarıyla birlikte kalıcı olarak silinir. Geri almak için fişe dokunun.`}>
        {items.map((item) => {
          const r = item.receipt;
          const meta = categoryMeta(r.kategori);
          return (
            <ListRow
              key={item.id}
              icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
              title={r.firma_adi}
              subtitle={`${shortTrDate(r.tarih)} · ${trashLeftLabel(trashDaysLeft(item.deleted_at))}`}
              value={formatTL(r.toplam_tutar)}
              onPress={() => act(item)}
            />
          );
        })}
      </ListSection>
    </ScrollView>
  );
}
