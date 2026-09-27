import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import {
  fromFormValues,
  ReceiptForm,
  type ReceiptFormValues,
  toFormValues,
  validateForm,
} from '../components/ReceiptForm';
import { confirmAction, showAlert } from '../lib/alert';
import { colors } from '../lib/theme';
import { showToast } from '../lib/toast';
import { DRAFT_WIDTH, prepareArchiveImage } from '../services/image/prepareReceiptImages';
import {
  deleteDraft,
  downloadDraftImage,
  draftImageUrls,
  listDrafts,
} from '../services/supabase/draftsRepository';
import { saveReceipt } from '../services/supabase/receiptsRepository';
import type { ReceiptDraft } from '../types/receipt';

/** Taranmış taslakları sırayla gösterir: kontrol et, düzelt, kaydet, sonrakine geç. */
export default function BatchReviewScreen() {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<ReceiptDraft[] | null>(null);
  const [values, setValues] = useState<ReceiptFormValues | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);

  const current = queue?.[0];

  const show = useCallback(async (d: ReceiptDraft | undefined) => {
    setImageUrl(null);
    setZoom(false);
    if (!d?.result) {
      setValues(null);
      return;
    }
    setValues(toFormValues(d.result));
    const urls = await draftImageUrls([d.image_path]);
    setImageUrl(urls[d.image_path] ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      listDrafts()
        .then((all) => {
          const ready = all.filter((d) => d.status === 'ready' && d.result);
          setQueue(ready);
          show(ready[0]);
        })
        .catch((e) => showAlert('Taslaklar alınamadı', (e as Error).message));
    }, [show]),
  );

  function next(savedNow: number) {
    const rest = queue!.slice(1);
    setQueue(rest);
    if (rest.length) {
      show(rest[0]);
    } else {
      router.back();
      if (savedNow) showToast(`${savedNow} fiş kaydedildi`);
    }
  }

  async function save() {
    if (!current || !values) return;
    const errors = validateForm(values);
    if (errors.length) {
      showAlert('Lütfen kontrol edin', errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const local = await downloadDraftImage(current.image_path);
      const archiveUri = await prepareArchiveImage(local, DRAFT_WIDTH);
      await saveReceipt(fromFormValues(values), archiveUri);
      await deleteDraft(current);
      const total = saved + 1;
      setSaved(total);
      next(total);
    } catch (e) {
      showAlert('Kaydedilemedi', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!current) return;
    confirmAction('Taslağı sil', 'Bu fiş kaydedilmeden silinecek.', 'Sil', async () => {
      await deleteDraft(current);
      next(saved);
    });
  }

  if (!queue) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />;
  }

  if (!current || !values) {
    return (
      <View style={styles.empty}>
        <Text style={{ fontSize: 48 }}>✅</Text>
        <Text style={styles.emptyTitle}>İncelenecek fiş kalmadı</Text>
        <PrimaryButton title="Geri dön" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.counter}>
          {saved + 1}. fiş · kalan {queue.length}
        </Text>

        <Pressable onPress={() => setZoom((z) => !z)} style={[styles.imageWrap, zoom && { height: 520 }]}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
          ) : (
            <ActivityIndicator color={colors.muted} />
          )}
          <Text style={styles.zoomHint}>{zoom ? 'Küçültmek için dokunun' : 'Büyütmek için dokunun'}</Text>
        </Pressable>

        <ReceiptForm values={values} onChange={setValues} />

        <PrimaryButton title={queue.length > 1 ? 'Kaydet ve sonraki' : 'Kaydet'} onPress={save} loading={saving} />
        <View style={styles.row}>
          <PrimaryButton
            title="Atla"
            variant="secondary"
            onPress={() => next(saved)}
            disabled={saving}
            style={{ flex: 1 }}
          />
          <PrimaryButton title="🗑️  Sil" variant="secondary" onPress={discard} disabled={saving} style={{ flex: 1 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  counter: { fontSize: 14, color: colors.muted, fontWeight: '700', textAlign: 'center' },
  imageWrap: {
    height: 220,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  zoomHint: {
    position: 'absolute',
    bottom: 8,
    color: '#fff',
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
});
