import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';

import { EmptyState } from '../components/ui/EmptyState';
import { ListRow, ListSection } from '../components/ui/List';
import { addedAtLabel } from '../lib/addedAt';
import { errorMessage } from '../lib/errors';
import { formatTL } from '../lib/format';
import { categoryMeta, useTheme } from '../lib/theme';
import { getRecentReceipts } from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';

const LIMIT = 30;
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
/** "2026-09-10" → "10 Eyl" (bu yıl değilse yılıyla) */
function dayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${AY[m! - 1]}${y === new Date().getFullYear() ? '' : ` ${y}`}`;
}

/** En son eklenen 30 fiş (fiş tarihine değil, uygulamaya eklenme zamanına göre). */
export default function RecentScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<ReceiptRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getRecentReceipts(LIMIT));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      setItems((cur) => cur ?? []);
    }
  }, []);

  // Fiş düzenlenip/silinip dönülünce güncel olsun
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!items) return <ActivityIndicator style={{ marginTop: 48 }} />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={async () => {
            setPulling(true);
            await load();
            setPulling(false);
          }}
        />
      }>
      {error && (
        <ListSection>
          <ListRow title="Fişler alınamadı" subtitle={error} tone="action" onPress={load} />
        </ListSection>
      )}
      {items.length === 0 && !error ? (
        <EmptyState icon={{ sf: 'clock', ion: 'time-outline' }} title="Fiş Yok" message="Eklediğiniz fişler burada en yeniden eskiye listelenir." />
      ) : (
        <ListSection
          header={`Son eklenen ${items.length} fiş`}
          footer="Fişler uygulamaya eklenme zamanına göre listelenir (solda eklenme zamanı, ardından fiş tarihi). Bütün fişler için Tüm Fişler'e bakın.">
          {items.map((r) => {
            const meta = categoryMeta(r.kategori);
            return (
              <ListRow
                key={r.id}
                icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
                title={r.firma_adi}
                subtitle={`${addedAtLabel(r.created_at)} · fiş ${dayMonth(r.tarih)}`}
                value={formatTL(r.toplam_tutar)}
                valueColor={theme.label}
                chevron
                onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })}
              />
            );
          })}
        </ListSection>
      )}
    </ScrollView>
  );
}
