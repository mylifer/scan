import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { EmptyState } from '../components/ui/EmptyState';
import { HeaderTextButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { confirmDestructive, showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { formatTL, shortTrDate } from '../lib/format';
import { haptics } from '../lib/haptics';
import { categoryMeta, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { TRASH_DAYS, trashDaysLeft, trashLeftLabel } from '../lib/trash';
import { listTrash, purgeTrash, restoreFromTrash, type TrashItem } from '../services/supabase/receiptsRepository';

/** Son Silinenler: silinen fişler 30 gün geri alınabilir. */
export default function TrashScreen() {
  const theme = useTheme();
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

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      {header}
      <ListSection footer={`Fişler silindikten ${TRASH_DAYS} gün sonra fotoğraflarıyla birlikte kalıcı olarak silinir. Geri almak için fişe dokunun.`}>
        {items.map((item) => {
          const r = item.receipt;
          const meta = categoryMeta[r.kategori] ?? categoryMeta['diğer'];
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
