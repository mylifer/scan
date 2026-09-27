import { errorMessage } from '../lib/errors';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AddPhotoButtons, type PickedPhoto } from '../components/AddPhotoButtons';
import { PhotoViewer } from '../components/PhotoViewer';
import { SetupSteps } from '../components/SetupSteps';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { ListRow, ListSection } from '../components/ui/List';
import { Toolbar, useToolbarHeight } from '../components/ui/Toolbar';
import { useDrafts } from '../hooks/useDrafts';
import { confirmDestructive, showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { haptics } from '../lib/haptics';
import { formatRunAt, nextRunAt, RECOMMENDED_HOUR, SCHEDULE_HOURS } from '../lib/schedule';
import { DRAFTS_SETUP_SQL } from '../lib/setupSql';
import { type Theme, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { isScannable } from '../services/drafts/draftProcessor';
import { clearUploadFailures, enqueueDraftUpload, getUploadState, subscribeUploads } from '../services/drafts/uploadQueue';
import { deleteDraft, deleteDrafts, draftImageUrls, scheduleDrafts } from '../services/supabase/draftsRepository';
import type { ReceiptDraft } from '../types/receipt';

export default function BatchScreen() {
  const theme = useTheme();
  const { drafts, loading, notSetUp, error, processor, refresh, run } = useDrafts();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploads, setUploads] = useState(getUploadState());
  const [viewer, setViewer] = useState<string | null>(null);

  // isScannable, kuyruğun çalışıp çalışmadığına da bakar; her render'da hesaplanır (ucuz)
  const scannable = drafts.filter(isScannable);
  const ready = drafts.filter((d) => d.status === 'ready');
  const scheduled = drafts.filter((d) => d.status === 'scheduled');
  const toolbarRows = (ready.length ? 1 : 0) + (scannable.length ? 1 : 0);
  const toolbarHeight = useToolbarHeight(Math.max(toolbarRows, 1));

  // Yeni eklenen taslakların önizleme bağlantılarını (her yol için bir kez) al
  const requested = useRef(new Set<string>());
  useEffect(() => {
    const missing = drafts.map((d) => d.image_path).filter((p) => !requested.current.has(p));
    if (!missing.length) return;
    missing.forEach((p) => requested.current.add(p));
    draftImageUrls(missing).then((m) => setUrls((u) => ({ ...u, ...m })));
  }, [drafts]);

  // Yükleme kuyruğunu izle: her tamamlanan yüklemede listeyi yenile, hataları bir kez bildir
  const lastCompleted = useRef(getUploadState().completed);
  useEffect(
    () =>
      subscribeUploads((st) => {
        setUploads(st);
        if (st.completed !== lastCompleted.current) {
          lastCompleted.current = st.completed;
          refresh();
        }
        if (st.failed) {
          showToast(`${st.failed} fotoğraf eklenemedi`, 'error');
          clearUploadFailures();
        }
      }),
    [refresh],
  );

  if (notSetUp)
    return (
      <SetupSteps
        sql={DRAFTS_SETUP_SQL}
        message="Toplu tarama, taslakları saklamak için Supabase'de yeni bir tabloya ihtiyaç duyuyor."
        onCheck={refresh}
      />
    );

  function addPhotos(photos: PickedPhoto[]) {
    photos.forEach((p) => enqueueDraftUpload(p.uri, p.width));
  }

  function openDraft(d: ReceiptDraft) {
    if (d.status === 'processing') return;
    haptics.tap();
    const url = urls[d.image_path];
    showActionSheet({
      title: d.result?.firmaAdi ?? statusText(d),
      message: d.status === 'failed' && d.error ? d.error : undefined,
      options: [
        ...(url ? [{ label: 'Fotoğrafı Görüntüle', onPress: () => setViewer(url) }] : []),
        ...(d.status === 'failed' && !processor.running ? [{ label: 'Tekrar Tara', onPress: () => run([d]) }] : []),
        {
          label: 'Taslağı Sil',
          destructive: true,
          onPress: async () => {
            try {
              await deleteDraft(d);
              refresh();
            } catch (e) {
              showAlert('Silinemedi', errorMessage(e));
            }
          },
        },
      ],
    });
  }

  function deleteAll() {
    const removable = drafts.filter((d) => d.status !== 'processing');
    confirmDestructive('Tüm Taslakları Sil', `${removable.length} taslak fotoğraf kalıcı olarak silinecek.`, 'Tümünü Sil', async () => {
      try {
        await deleteDrafts(removable);
        haptics.success();
        refresh();
      } catch (e) {
        showAlert('Silinemedi', errorMessage(e));
      }
    });
  }

  function pickSchedule() {
    showActionSheet({
      title: 'Ne zaman taransın?',
      message: 'Fiyatlar saate göre değişmez; önerilen saatte (ABD’de gece) sunucular genellikle daha sakindir.',
      options: SCHEDULE_HOURS.map((h) => {
        const at = nextRunAt(h);
        return {
          label: `${formatRunAt(at.toISOString())}${h === RECOMMENDED_HOUR ? '  (önerilen)' : ''}`,
          onPress: async () => {
            await scheduleDrafts(
              scannable.map((d) => d.id),
              at,
            );
            await refresh();
            showToast(`${scannable.length} fiş ${formatRunAt(at.toISOString())} için planlandı`, 'info', 3500);
          },
        };
      }),
    });
  }

  const uploading = uploads.pending > 0;
  const busy = processor.running || uploading;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 8, paddingBottom: toolbarHeight }}>
        <AddPhotoButtons onPicked={addPhotos} />

        {uploading && (
          <ListSection>
            <View style={styles.uploadRow}>
              <ActivityIndicator />
              <Text style={[t.body, { color: theme.label }]}>{uploads.pending} fotoğraf yükleniyor…</Text>
            </View>
          </ListSection>
        )}
        {processor.running && (
          <ListSection>
            <ProgressRow theme={theme} label={`Taranıyor ${processor.done}/${processor.total}`} value={processor.done / Math.max(processor.total, 1)} />
          </ListSection>
        )}

        {!processor.running && processor.stoppedReason && scannable.length > 0 && scheduled.length === 0 && (
          <ListSection footer="Ücretsiz planın günlük hakkı Türkiye saatiyle 10:00–11:00 civarında yenilenir.">
            <ListRow
              title="Tarama durdu"
              subtitle={processor.stoppedReason}
              icon={{ sf: 'pause.circle.fill', ion: 'pause-circle', color: theme.orange }}
            />
            <ListRow title={`Kalan ${scannable.length} Fişi Planla`} tone="action" onPress={pickSchedule} />
          </ListSection>
        )}

        {error && (
          <ListSection>
            <ListRow title="Taslaklar alınamadı" subtitle={error} icon={{ sf: 'wifi.exclamationmark', ion: 'cloud-offline', color: theme.orange }} onPress={refresh} />
          </ListSection>
        )}

        {scheduled.length > 0 && (
          <ListSection footer="O saatten sonra uygulamayı ilk açtığınızda tarama kendiliğinden başlar.">
            <ListRow
              title={`${formatRunAt(scheduled[0].scheduled_for!)} için planlı`}
              subtitle={`${scheduled.length} fiş`}
              icon={{ sf: 'clock.fill', ion: 'time', color: theme.purple }}
            />
            <ListRow
              title="Planı İptal Et"
              tone="destructive"
              onPress={async () => {
                await scheduleDrafts(
                  scheduled.map((d) => d.id),
                  null,
                );
                refresh();
              }}
            />
          </ListSection>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={{ sf: 'square.stack.3d.up', ion: 'layers-outline' }}
            title="Taslak Yok"
            message="Fişlerin fotoğraflarını arka arkaya çekin; istediğiniz zaman topluca taratın."
          />
        ) : (
          <View style={{ marginBottom: 28 }}>
            <Text style={[t.footnote, styles.gridHeader, { color: theme.secondaryLabel }]}>TASLAKLAR · {drafts.length}</Text>
            <View style={styles.grid}>
              {drafts.map((d) => (
                <Pressable key={d.id} onPress={() => openDraft(d)} style={({ pressed }) => [styles.tile, { backgroundColor: theme.fill, opacity: pressed ? 0.7 : 1 }]}>
                  {urls[d.image_path] ? (
                    <Image source={{ uri: urls[d.image_path] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                  ) : (
                    <ActivityIndicator style={{ flex: 1 }} />
                  )}
                  <StatusBadge draft={d} theme={theme} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {drafts.length > 1 && (
          <ListSection>
            <ListRow title="Tüm Taslakları Sil" tone="destructive" onPress={deleteAll} disabled={processor.running} />
          </ListSection>
        )}
      </ScrollView>

      <PhotoViewer uri={viewer} visible={!!viewer} onClose={() => setViewer(null)} />

      {toolbarRows > 0 && (
        <Toolbar>
          {ready.length > 0 && (
            <Button
              title={`İncele ve Kaydet (${ready.length})`}
              icon={{ sf: 'checkmark.circle.fill', ion: 'checkmark-circle' }}
              onPress={() => router.push('/batch-review')}
              disabled={processor.running}
            />
          )}
          {scannable.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                title={`Şimdi Tara (${scannable.length})`}
                icon={{ sf: 'text.viewfinder', ion: 'scan' }}
                variant={ready.length ? 'tinted' : 'filled'}
                onPress={() => run(scannable)}
                loading={processor.running}
                disabled={busy}
                style={{ flex: 1 }}
              />
              <Button title="Planla" icon={{ sf: 'clock', ion: 'time-outline' }} variant="gray" onPress={pickSchedule} disabled={busy} />
            </View>
          )}
        </Toolbar>
      )}
    </View>
  );
}

function statusText(d: ReceiptDraft) {
  return { pending: 'Taranmayı bekliyor', scheduled: 'Planlı', processing: 'Taranıyor', ready: 'Hazır', failed: 'Okunamadı' }[d.status];
}

function StatusBadge({ draft, theme }: { draft: ReceiptDraft; theme: Theme }) {
  if (draft.status === 'pending') return null;
  const spec = {
    scheduled: { sf: 'clock.fill', ion: 'time', color: theme.purple },
    ready: { sf: 'checkmark.circle.fill', ion: 'checkmark-circle', color: theme.green },
    failed: { sf: 'exclamationmark.circle.fill', ion: 'alert-circle', color: theme.red },
    processing: null,
  }[draft.status];
  return (
    <BlurView intensity={60} tint="dark" style={styles.badge}>
      {spec ? <Icon sf={spec.sf} ion={spec.ion} size={18} color={spec.color} /> : <ActivityIndicator size="small" color="#fff" />}
    </BlurView>
  );
}

function ProgressRow({ label, value, theme, isLast }: { label: string; value: number; theme: Theme; isLast?: boolean }) {
  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={[t.body, { color: theme.label }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: theme.tertiaryFill }]}>
        <View style={[styles.fill, { width: `${Math.round(value * 100)}%`, backgroundColor: theme.blue }]} />
      </View>
    </View>
  );
}

/** receipt_drafts tablosu yoksa: kodu kopyala → Supabase'i aç → çalıştır → kontrol et */
const styles = StyleSheet.create({
  gridHeader: { marginLeft: 32, marginBottom: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  tile: { width: '32.9%', aspectRatio: 0.75, overflow: 'hidden' },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 44 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
