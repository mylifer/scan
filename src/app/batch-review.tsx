import { errorMessage } from '../lib/errors';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { fromFormValues, ReceiptForm, type ReceiptFormValues, toFormValues, validateForm } from '../components/ReceiptForm';
import { ReceiptPhoto } from '../components/ReceiptPhoto';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { HeaderTextButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { confirmDestructive } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { confirmIfDuplicate } from '../lib/confirmDuplicate';
import { haptics } from '../lib/haptics';
import { useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { DRAFT_WIDTH, prepareArchiveImage } from '../services/image/prepareReceiptImages';
import { deleteDraft, downloadDraftImage, draftImageUrls, listDrafts } from '../services/supabase/draftsRepository';
import { saveReceipt } from '../services/supabase/receiptsRepository';
import type { ReceiptDraft } from '../types/receipt';

/** Taranmış taslakları sırayla gösterir: kontrol et, düzelt, kaydet, sonrakine geç. */
export default function BatchReviewScreen() {
  const theme = useTheme();
  const [queue, setQueue] = useState<ReceiptDraft[] | null>(null);
  const [total, setTotal] = useState(0);
  const [values, setValues] = useState<ReceiptFormValues | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);

  const current = queue?.[0];

  const show = useCallback(async (d: ReceiptDraft | undefined) => {
    setImageUrl(null);
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
          setTotal(ready.length);
          show(ready[0]);
        })
        .catch((e) => showAlert('Taslaklar alınamadı', errorMessage(e)));
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
      haptics.error();
      showAlert('Lütfen kontrol edin', errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const data = fromFormValues(values);
      if (!(await confirmIfDuplicate(data))) return;
      const local = await downloadDraftImage(current.image_path);
      const archiveUri = await prepareArchiveImage(local, DRAFT_WIDTH);
      await saveReceipt(data, archiveUri);
      await deleteDraft(current);
      haptics.success();
      const count = saved + 1;
      setSaved(count);
      next(count);
    } catch (e) {
      haptics.error();
      showAlert('Kaydedilemedi', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!current) return;
    confirmDestructive('Taslağı Sil', 'Bu fiş kaydedilmeden silinecek.', 'Taslağı Sil', async () => {
      await deleteDraft(current);
      next(saved);
    });
  }

  if (!queue) return <ActivityIndicator style={{ marginTop: 120 }} />;

  if (!current || !values) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
        <EmptyState icon={{ sf: 'checkmark.circle', ion: 'checkmark-circle-outline' }} title="Hepsi Tamam" message="İncelenecek fiş kalmadı." />
        <View style={{ paddingHorizontal: 20 }}>
          <Button title="Geri Dön" variant="gray" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const position = total - queue.length + 1;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: `${position} / ${total}`,
          headerRight: () => (saving ? <ActivityIndicator /> : <HeaderTextButton title="Kaydet" bold onPress={save} />),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        <ReceiptPhoto uri={imageUrl} />
        <ReceiptForm values={values} onChange={setValues} />
        <ListSection>
          <ListRow title={queue.length > 1 ? 'Atla, Sonrakine Geç' : 'Atla'} tone="action" onPress={() => next(saved)} disabled={saving} />
          <ListRow title="Taslağı Sil" tone="destructive" onPress={discard} disabled={saving} />
        </ListSection>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
