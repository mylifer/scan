import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState } from '../components/ui/EmptyState';
import { ListRow, ListSection } from '../components/ui/List';
import { confirmDestructive, showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { haptics } from '../lib/haptics';
import { useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { type AppErrorRecord, clearErrors, listErrors } from '../services/errorLog';

/** Uygulamada yaşanan beklenmeyen hatalar (sorun bildirirken kopyalanıp paylaşılabilir). */
export default function ErrorsScreen() {
  const theme = useTheme();
  const [items, setItems] = useState<AppErrorRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await listErrors());
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const text = (r: AppErrorRecord) =>
    [`${formatTime(r.created_at)} · ${r.context}`, r.message, r.app_version && `Sürüm ${r.app_version} · ${r.platform ?? ''}`, r.detail].filter(Boolean).join('\n');

  async function copy(content: string) {
    try {
      if (!(await Clipboard.setStringAsync(content))) throw new Error();
      showToast('Kopyalandı');
    } catch {
      showAlert('Hata ayrıntısı', content.slice(0, 1500));
    }
  }

  function open(r: AppErrorRecord) {
    showActionSheet({
      title: r.context,
      message: r.message.slice(0, 300),
      options: [{ label: 'Ayrıntıyı Kopyala', onPress: () => copy(text(r)) }],
    });
  }

  function clearAll() {
    confirmDestructive('Hata Kayıtları', 'Tüm hata kayıtları silinecek.', 'Tümünü Sil', async () => {
      try {
        await clearErrors();
        haptics.success();
        setItems([]);
      } catch (e) {
        showAlert('Silinemedi', errorMessage(e));
      }
    });
  }

  if (!items && !error) return <ActivityIndicator style={{ marginTop: 48 }} />;

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
          <ListRow title="Kayıtlar alınamadı" subtitle={error} tone="action" onPress={load} />
        </ListSection>
      )}
      {items && items.length === 0 ? (
        <View style={{ marginTop: 40 }}>
          <EmptyState
            icon={{ sf: 'checkmark.seal', ion: 'checkmark-circle-outline' }}
            title="Hata Yok"
            message="Uygulamada beklenmeyen bir hata olursa burada görünür. İnternet kesintileri ve yapay zekâ yoğunluğu kaydedilmez."
          />
        </View>
      ) : (
        items && (
          <>
            <ListSection header={`Son ${items.length} kayıt`} footer="Bir kayda dokunarak ayrıntısını kopyalayabilir, sorun bildirirken paylaşabilirsiniz.">
              {items.map((r) => (
                <ListRow
                  key={r.id}
                  title={r.message}
                  subtitle={`${formatTime(r.created_at)} · ${r.context}`}
                  icon={{ sf: 'exclamationmark.triangle.fill', ion: 'warning', color: theme.orange }}
                  onPress={() => open(r)}
                  chevron
                />
              ))}
            </ListSection>
            <ListSection>
              <ListRow title="Tümünü Sil" tone="destructive" onPress={clearAll} />
            </ListSection>
          </>
        )
      )}
    </ScrollView>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
