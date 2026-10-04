import { errorMessage } from '../lib/errors';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

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
import { type as t, useTheme } from '../lib/theme';
import { getProcessorState, isAutoScanBusy, subscribeDraftStatus, subscribeProcessor } from '../services/drafts/draftProcessor';
import { getUploadState, subscribeUploads } from '../services/drafts/uploadQueue';
import { showToast } from '../lib/toast';
import { DRAFT_WIDTH, prepareArchiveImage } from '../services/image/prepareReceiptImages';
import { deleteDraft, downloadDraftImage, draftImageUrls, listDrafts } from '../services/supabase/draftsRepository';
import { releaseLocal } from '../services/supabase/storageFiles';
import { saveReceipt } from '../services/supabase/receiptsRepository';
import type { ReceiptDraft } from '../types/receipt';
import { useSingleFlight } from '../hooks/useSingleFlight';

/**
 * Taranmış taslakları sırayla gösterir: kontrol et, düzelt, kaydet, sonrakine geç.
 * Hızlı çekimde fişler arka planda okunurken açılır: okunanlar hazır oldukça sıraya eklenir.
 */
export default function BatchReviewScreen() {
  const theme = useTheme();
  const runOnce = useSingleFlight();
  const [queue, setQueue] = useState<ReceiptDraft[] | null>(null);
  const [total, setTotal] = useState(0);
  const [values, setValues] = useState<ReceiptFormValues | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(0);

  const current = queue?.[0];
  // Bu ekranda kaydedilen / atlanan / silinen taslaklar (yeniden listelenince tekrar gelmesin)
  const handled = useRef(new Set<string>());
  const queueRef = useRef<ReceiptDraft[] | null>(null);
  const setQ = (q: ReceiptDraft[]) => {
    queueRef.current = q;
    setQueue(q);
  };
  /** Okuma ya da yükleme sürüyor mu (sürüyorsa sıra boşalınca beklenir) */
  const scanBusy = () => isAutoScanBusy() || getUploadState().pending > 0;
  const [busy, setBusy] = useState(scanBusy);

  // Gösterilen taslak: hızlı "Atla"da geç gelen önceki fotoğraf bağlantısı yeni taslağın yanına konmasın
  const shownId = useRef<string | null>(null);

  const show = useCallback(async (d: ReceiptDraft | undefined) => {
    shownId.current = d?.id ?? null;
    setImageUrl(null);
    if (!d?.result) {
      setValues(null);
      return;
    }
    setValues(toFormValues(d.result));
    const urls = await draftImageUrls([d.image_path]);
    if (shownId.current === d.id) setImageUrl(urls[d.image_path] ?? null);
  }, []);

  /** Hazır taslakları sıranın sonuna ekler (gösterilen fiş değişmez) */
  const loadReady = useCallback(async () => {
    const all = await listDrafts();
    const base = queueRef.current ?? [];
    const ids = new Set(base.map((d) => d.id));
    const add = all.filter((d) => d.status === 'ready' && d.result && !ids.has(d.id) && !handled.current.has(d.id));
    const merged = [...base, ...add];
    queueRef.current = merged;
    setQueue(merged);
    setTotal((n) => n + add.length);
    if (base.length === 0 && merged.length) show(merged[0]);
  }, [show]);

  useFocusEffect(
    useCallback(() => {
      loadReady().catch((e) => showAlert('Taslaklar alınamadı', errorMessage(e)));
    }, [loadReady]),
  );

  // Arka planda okunan fişler hazır oldukça sıraya eklensin; okuma bitince bir kez daha bak
  useEffect(() => {
    let was = scanBusy();
    const refreshBusy = () => {
      const b = scanBusy();
      if (was && !b) loadReady().catch(() => {});
      was = b;
      setBusy(b);
    };
    const unsubs = [
      subscribeDraftStatus((_, status) => {
        if (status === 'ready') loadReady().catch(() => {});
      }),
      subscribeProcessor(refreshBusy),
      subscribeUploads(refreshBusy),
    ];
    return () => unsubs.forEach((u) => u());
  }, [loadReady]);

  function next(savedNow: number) {
    if (current) handled.current.add(current.id);
    const rest = (queueRef.current ?? []).slice(1);
    setQ(rest);
    if (rest.length) {
      show(rest[0]);
    } else if (scanBusy()) {
      // Okunmakta olan fişler var: ekranda kal, hazır oldukça gelsin
      setValues(null);
    } else {
      router.back();
      if (savedNow) showToast(`${savedNow} fiş kaydedildi`);
    }
  }

  async function save() {
    await runOnce(async () => {
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
        const archiveUri = await prepareArchiveImage(local, DRAFT_WIDTH).finally(() => releaseLocal(local));
        await saveReceipt(data, archiveUri);
        // Fiş kaydedildi; taslak silinemese bile "Kaydedilemedi" denmemeli (tekrar kaydedip çift kayıt oluşmasın)
        try {
          await deleteDraft(current);
        } catch {
          showToast('Fiş kaydedildi, taslak silinemedi. Toplu Tarama ekranından silebilirsiniz.', 'info', 4500);
        }
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
    });
  }

  function discard() {
    if (!current) return;
    confirmDestructive('Taslağı Sil', 'Bu fiş kaydedilmeden silinecek.', 'Taslağı Sil', async () => {
      try {
        await deleteDraft(current);
        next(saved);
      } catch (e) {
        showAlert('Taslak silinemedi', errorMessage(e));
      }
    });
  }

  if (!queue) return <ActivityIndicator style={{ marginTop: 120 }} />;

  if (!current && busy) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24, backgroundColor: theme.background }}>
        <ActivityIndicator size="large" />
        <Text style={[t.title3, { color: theme.label, textAlign: 'center' }]}>Fişler okunuyor…</Text>
        <Text style={[t.subhead, { color: theme.secondaryLabel, textAlign: 'center' }]}>
          {saved ? `${saved} fiş kaydedildi. ` : ''}Okunan fişler hazır oldukça burada açılır. İsterseniz çıkabilirsiniz; okuma arka planda sürer ve fişler ana sayfadaki Taslaklar’da bekler.
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
          <Button title="Ana Sayfaya Dön" variant="gray" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  if (!current || !values) {
    const stopped = getProcessorState().stoppedReason;
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
        {stopped ? (
          <EmptyState
            icon={{ sf: 'exclamationmark.triangle', ion: 'warning-outline' }}
            title="Okuma Durdu"
            message={`${stopped}\n\nOkunamayan fişler Toplu Tarama'da bekliyor; daha sonra oradan tekrar taratabilirsiniz.`}
          />
        ) : (
          <EmptyState
            icon={{ sf: 'checkmark.circle', ion: 'checkmark-circle-outline' }}
            title="Hepsi Tamam"
            message={saved ? `${saved} fiş kaydedildi. İncelenecek fiş kalmadı.` : 'İncelenecek fiş kalmadı.'}
          />
        )}
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
