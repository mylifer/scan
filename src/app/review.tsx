import { errorMessage } from '../lib/errors';
import { Redirect, router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { emptyForm, fromFormValues, ReceiptForm, type ReceiptFormValues, toFormValues, validateForm } from '../components/ReceiptForm';
import { ReceiptPhoto } from '../components/ReceiptPhoto';
import { HeaderTextButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { showAlert } from '../lib/alert';
import { confirmIfDuplicate } from '../lib/confirmDuplicate';
import { capitalizeTr, monthRange } from '../lib/format';
import { haptics } from '../lib/haptics';
import { getPendingPhoto } from '../lib/pendingPhoto';
import { type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { prepareDraftImage, prepareReceiptImages } from '../services/image/prepareReceiptImages';
import { addDraft } from '../services/supabase/draftsRepository';
import { applyLearnedCategory, saveReceipt } from '../services/supabase/receiptsRepository';
import { getVisionService } from '../services/vision';
import { useSingleFlight } from '../hooks/useSingleFlight';

type Phase = 'analyzing' | 'ready' | 'error';

export default function ReviewScreen() {
  const theme = useTheme();
  const runOnce = useSingleFlight();
  const photo = getPendingPhoto();
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ReceiptFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [learned, setLearned] = useState(false);
  const archiveUri = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!photo) return;
      const images = await prepareReceiptImages(photo.uri);
      archiveUri.current = images.archiveUri;
      const { data, learned } = await applyLearnedCategory(await getVisionService().analyzeReceipt(images.ai, controller.signal));
      if (controller.signal.aborted) return;
      setValues(toFormValues(data));
      setLearned(learned);
      setPhase('ready');
      haptics.success();
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(errorMessage(e));
      setPhase('error');
      haptics.error();
    }
  }, [photo]);

  useEffect(() => {
    // analyze asenkron: durum yalnızca AI yanıtı geldikten sonra (await sonrası) güncellenir
    // eslint-disable-next-line react-hooks/set-state-in-effect
    analyze();
    return () => abortRef.current?.abort();
  }, [analyze]);

  async function handleSave() {
    await runOnce(async () => {
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
        const { record, imageWarning } = await saveReceipt(data, archiveUri.current);
        router.replace('/');
        if (imageWarning) {
          showToast('Fiş kaydedildi, fotoğrafı yüklenemedi', 'info', 4000);
        } else {
          const { from, to } = monthRange(0);
          const otherMonth = record.tarih < from || record.tarih >= to;
          showToast(otherMonth ? `Kaydedildi · ${monthLabelOf(record.tarih)}` : 'Fiş kaydedildi');
        }
      } catch (e) {
        haptics.error();
        showAlert('Kaydedilemedi', errorMessage(e));
      } finally {
        setSaving(false);
      }
    });
  }

  // AI yoğun/kota dolu olduğunda fotoğraf kaybolmasın: taslağa ekle, sonra Toplu Tarama'dan taranır
  async function saveAsDraft() {
    await runOnce(async () => {
      if (!photo) return;
      setSaving(true);
      try {
        await addDraft(await prepareDraftImage(photo.uri, photo.width || 3000));
        haptics.success();
        router.replace('/');
        showToast('Taslaklara eklendi; Toplu Tarama\'dan taratabilirsiniz', 'info', 3500);
      } catch (e) {
        haptics.error();
        showAlert('Taslağa eklenemedi', errorMessage(e));
      } finally {
        setSaving(false);
      }
    });
  }

  // Sayfa yenilendiyse fotoğraf bellekte kalmaz; ana sayfaya dön
  if (!photo) return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () =>
            saving ? <ActivityIndicator /> : <HeaderTextButton title="Kaydet" bold onPress={handleSave} disabled={phase !== 'ready'} />,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        <ReceiptPhoto uri={photo.uri} />

        {phase === 'analyzing' && (
          <ListSection footer="Fotoğraf yapay zekâ ile okunuyor. Birkaç saniye sürebilir.">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 44 }}>
              <ActivityIndicator />
              <Text style={[t.body, { color: theme.label }]}>{providerName()} fişi okuyor…</Text>
            </View>
          </ListSection>
        )}

        {phase === 'error' && (
          <ListSection footer={error ?? undefined}>
            <ListRow title="Fiş okunamadı" icon={{ sf: 'exclamationmark.triangle.fill', ion: 'warning', color: theme.orange }} />
            <ListRow
              title="Tekrar Dene"
              tone="action"
              onPress={() => {
                setPhase('analyzing');
                setError(null);
                analyze();
              }}
            />
            <ListRow title="Bilgileri Elle Gir" tone="action" onPress={() => setPhase('ready')} />
            <ListRow
              title="Taslak Olarak Sakla"
              subtitle="Daha sonra Toplu Tarama'dan taratın"
              tone="action"
              onPress={saveAsDraft}
              disabled={saving}
              accessory={saving ? <ActivityIndicator /> : undefined}
            />
          </ListSection>
        )}

        {phase === 'ready' && (
          <>
            <ReceiptForm values={values} onChange={setValues} />
            {learned && (
              <Text style={[t.footnote, { color: theme.secondaryLabel, marginHorizontal: 32, marginTop: -20, marginBottom: 24 }]}>
                Kategori, bu firmanın önceki fişinizden alındı.
              </Text>
            )}
            <ListSection>
              <ListRow title="Yeniden Çek" tone="action" onPress={() => router.replace('/camera')} disabled={saving} />
            </ListSection>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** "2026-08-28" → "Ağustos 2026" */
function monthLabelOf(iso: string) {
  const [y, m] = iso.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  return capitalizeTr(label);
}

function providerName() {
  try {
    return getVisionService().providerName;
  } catch {
    return 'Yapay zekâ';
  }
}
