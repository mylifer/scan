import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { showAlert } from '../lib/alert';
import { todayTr } from '../lib/format';
import { getPendingPhoto } from '../lib/pendingPhoto';
import { colors } from '../lib/theme';
import { prepareReceiptImages } from '../services/image/prepareReceiptImages';
import { saveReceipt } from '../services/supabase/receiptsRepository';
import { getVisionService } from '../services/vision';

type Phase = 'analyzing' | 'ready' | 'error';

const EMPTY_FORM: ReceiptFormValues = {
  firmaAdi: '',
  tarih: todayTr(),
  toplamTutar: '',
  kdvYuzde1: '0,00',
  kdvYuzde10: '0,00',
  kdvYuzde20: '0,00',
  kategori: 'ofis gideri',
};

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const photo = getPendingPhoto();
  const [phase, setPhase] = useState<Phase>('analyzing');
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ReceiptFormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const archiveUri = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('analyzing');
    setError(null);
    try {
      if (!photo) return;
      const images = await prepareReceiptImages(photo.uri, photo.width || 3000);
      archiveUri.current = images.archiveUri;
      const data = await getVisionService().analyzeReceipt(images.ai, controller.signal);
      if (controller.signal.aborted) return;
      setValues(toFormValues(data));
      setPhase('ready');
    } catch (e) {
      if (controller.signal.aborted) return;
      setError((e as Error).message);
      setPhase('error');
    }
  }, [photo]);

  useEffect(() => {
    analyze();
    return () => abortRef.current?.abort();
  }, [analyze]);

  async function handleSave() {
    const errors = validateForm(values);
    if (errors.length) {
      showAlert('Lütfen kontrol edin', errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const { imageWarning } = await saveReceipt(fromFormValues(values), archiveUri.current);
      if (imageWarning) showAlert('Fiş kaydedildi', imageWarning);
      router.back();
    } catch (e) {
      showAlert('Kaydedilemedi', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Sayfa yenilendiyse fotoğraf bellekte kalmaz; ana sayfaya dön
  if (!photo) return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.previewRow}>
          <Image source={{ uri: photo.uri }} style={styles.thumb} />
          <View style={{ flex: 1, justifyContent: 'center' }}>
            {phase === 'analyzing' && (
              <View style={styles.status}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.statusText}>{getProviderName()} fişi okuyor…</Text>
              </View>
            )}
            {phase === 'ready' && (
              <Text style={styles.statusText}>✅ Okundu. Hatalı alan varsa düzeltip kaydedin.</Text>
            )}
            {phase === 'error' && (
              <View style={{ gap: 6 }}>
                <Text style={[styles.statusText, { color: colors.danger }]}>⚠️ Okunamadı</Text>
                <Text style={styles.errorDetail} numberOfLines={3}>
                  {error}
                </Text>
              </View>
            )}
          </View>
        </View>

        {phase === 'error' && (
          <View style={styles.row}>
            <PrimaryButton title="Tekrar dene" onPress={analyze} style={{ flex: 1 }} />
            <PrimaryButton
              title="Elle doldur"
              variant="secondary"
              onPress={() => setPhase('ready')}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {phase === 'ready' && (
          <>
            <ReceiptForm values={values} onChange={setValues} />
            <PrimaryButton title="Kaydet" onPress={handleSave} loading={saving} />
            <PrimaryButton
              title="Yeniden çek"
              variant="secondary"
              onPress={() => router.replace('/camera')}
              disabled={saving}
            />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getProviderName() {
  try {
    return getVisionService().providerName;
  } catch {
    return 'Yapay zekâ';
  }
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  previewRow: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 72, height: 110, borderRadius: 10, backgroundColor: '#E2E8F0' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  errorDetail: { fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', gap: 10 },
});
