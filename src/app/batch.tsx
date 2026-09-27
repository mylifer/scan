import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddPhotoButtons, type PickedPhoto } from '../components/AddPhotoButtons';
import { PrimaryButton } from '../components/PrimaryButton';
import { useDrafts } from '../hooks/useDrafts';
import { confirmAction, showAlert } from '../lib/alert';
import { formatRunAt, nextRunAt, RECOMMENDED_HOUR, SCHEDULE_HOURS } from '../lib/schedule';
import { colors } from '../lib/theme';
import { showToast } from '../lib/toast';
import { isScannable } from '../services/drafts/draftProcessor';
import { prepareDraftImage } from '../services/image/prepareReceiptImages';
import { addDraft, deleteDraft, draftImageUrls, scheduleDrafts } from '../services/supabase/draftsRepository';
import type { ReceiptDraft } from '../types/receipt';

export default function BatchScreen() {
  const insets = useSafeAreaInsets();
  const { drafts, loading, notSetUp, error, processor, refresh, run } = useDrafts();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [hour, setHour] = useState<number>(RECOMMENDED_HOUR);

  const scannable = useMemo(() => drafts.filter(isScannable), [drafts, processor.running]);
  const ready = drafts.filter((d) => d.status === 'ready');
  const scheduled = drafts.filter((d) => d.status === 'scheduled');

  // Yeni eklenen taslakların önizleme bağlantılarını al
  useEffect(() => {
    const missing = drafts.map((d) => d.image_path).filter((p) => !urls[p]);
    if (missing.length) draftImageUrls(missing).then((m) => setUrls((u) => ({ ...u, ...m })));
  }, [drafts]);

  async function addPhotos(photos: PickedPhoto[]) {
    setUploading({ done: 0, total: photos.length });
    let failed = 0;
    for (let i = 0; i < photos.length; i++) {
      try {
        await addDraft(await prepareDraftImage(photos[i].uri, photos[i].width));
      } catch {
        failed++;
      }
      setUploading({ done: i + 1, total: photos.length });
      refresh();
    }
    setUploading(null);
    if (failed) showToast(`${failed} fotoğraf eklenemedi`, 'error');
  }

  function remove(d: ReceiptDraft) {
    confirmAction('Taslağı sil', 'Bu fotoğraf taslaklardan silinecek.', 'Sil', async () => {
      try {
        await deleteDraft(d);
        refresh();
      } catch (e) {
        showAlert('Silinemedi', (e as Error).message);
      }
    });
  }

  async function schedule() {
    const at = nextRunAt(hour);
    await scheduleDrafts(
      scannable.map((d) => d.id),
      at,
    );
    setShowSchedule(false);
    await refresh();
    showToast(`${scannable.length} fiş ${formatRunAt(at.toISOString())} için planlandı`, 'info', 3500);
  }

  async function unschedule() {
    await scheduleDrafts(
      scheduled.map((d) => d.id),
      null,
    );
    refresh();
  }

  if (notSetUp) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={{ fontSize: 48 }}>🛠️</Text>
        <Text style={styles.title}>Kurulum gerekli</Text>
        <Text style={styles.muted}>
          Toplu tarama için Supabase'de tek seferlik bir ayar yapılması gerekiyor. Talimatlar size ayrıca iletildi.
        </Text>
      </View>
    );
  }

  const busy = processor.running || !!uploading;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 180 }]}>
        <AddPhotoButtons onPicked={addPhotos} disabled={!!uploading} />

        {uploading && (
          <Progress label={`Fotoğraflar kaydediliyor ${uploading.done}/${uploading.total}`} value={uploading.done / uploading.total} />
        )}
        {processor.running && (
          <Progress label={`Taranıyor ${processor.done}/${processor.total}`} value={processor.done / processor.total} />
        )}
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}

        {scheduled.length > 0 && (
          <View style={styles.info}>
            <Text style={styles.infoText}>
              ⏰ {scheduled.length} fiş {formatRunAt(scheduled[0].scheduled_for!)} için planlı. O saatten sonra uygulamayı
              açtığınızda otomatik taranır.
            </Text>
            <Pressable onPress={unschedule} hitSlop={8}>
              <Text style={styles.link}>Planı iptal et</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : drafts.length === 0 ? (
          <View style={[styles.center, { paddingVertical: 40 }]}>
            <Text style={{ fontSize: 48 }}>📚</Text>
            <Text style={styles.title}>Taslak yok</Text>
            <Text style={styles.muted}>
              Fişlerin fotoğraflarını arka arkaya çekin. Hepsi taslak olarak saklanır; istediğiniz zaman topluca taratırsınız.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {drafts.map((d) => (
              <View key={d.id} style={styles.tile}>
                {urls[d.image_path] ? (
                  <Image source={{ uri: urls[d.image_path] }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.center]}>
                    <ActivityIndicator color={colors.muted} />
                  </View>
                )}
                <StatusBadge draft={d} />
                {d.status !== 'processing' && (
                  <Pressable onPress={() => remove(d)} style={styles.remove} hitSlop={6} accessibilityLabel="Taslağı sil">
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {(showSchedule || ready.length > 0 || scannable.length > 0) && (
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {showSchedule ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.footerTitle}>Hangi saatte taransın? (Türkiye saati)</Text>
            <View style={styles.chips}>
              {SCHEDULE_HOURS.map((h) => (
                <Pressable key={h} onPress={() => setHour(h)} style={[styles.chip, hour === h && styles.chipActive]}>
                  <Text style={[styles.chipText, hour === h && { color: '#fff' }]}>
                    {String(h).padStart(2, '0')}:00{h === RECOMMENDED_HOUR ? ' ★' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.muted}>★ ABD'de gece olduğu için sunucular genellikle daha sakin.</Text>
            <View style={styles.row}>
              <PrimaryButton title="Vazgeç" variant="secondary" onPress={() => setShowSchedule(false)} style={{ flex: 1 }} />
              <PrimaryButton title={`Planla (${scannable.length})`} onPress={schedule} style={{ flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {ready.length > 0 && (
              <PrimaryButton title={`✅  İncele ve kaydet (${ready.length})`} onPress={() => router.push('/batch-review')} disabled={processor.running} />
            )}
            {scannable.length > 0 && (
              <View style={styles.row}>
                <PrimaryButton
                  title={`🔍  Şimdi tara (${scannable.length})`}
                  variant={ready.length ? 'secondary' : 'primary'}
                  onPress={() => run(scannable)}
                  loading={processor.running}
                  disabled={busy}
                  style={{ flex: 1.3 }}
                />
                <PrimaryButton title="⏰  Sonra" variant="secondary" onPress={() => setShowSchedule(true)} disabled={busy} style={{ flex: 1 }} />
              </View>
            )}
          </View>
        )}
      </View>
      )}
    </View>
  );
}

function StatusBadge({ draft }: { draft: ReceiptDraft }) {
  const map = {
    pending: { text: 'Bekliyor', bg: '#E2E8F0', fg: colors.text },
    scheduled: { text: '⏰ Planlı', bg: '#EDE9FE', fg: '#5B21B6' },
    processing: { text: 'Taranıyor…', bg: '#DBEAFE', fg: colors.primaryDark },
    ready: { text: '✓ Hazır', bg: colors.successBg, fg: colors.success },
    failed: { text: 'Hata', bg: '#FEE2E2', fg: colors.danger },
  } as const;
  const m = map[draft.status];
  return (
    <View style={[styles.badge, { backgroundColor: m.bg }]}>
      <Text style={[styles.badgeText, { color: m.fg }]} numberOfLines={1}>
        {draft.status === 'ready' && draft.result?.firmaAdi ? draft.result.firmaAdi : m.text}
      </Text>
    </View>
  );
}

function Progress({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.progressLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(value * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 },
  info: { backgroundColor: '#F5F3FF', borderRadius: 14, padding: 12, gap: 6 },
  infoText: { color: '#5B21B6', fontSize: 14, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', aspectRatio: 0.62, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  thumb: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: 6, right: 6, bottom: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  progressLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '700', color: colors.text },
});
