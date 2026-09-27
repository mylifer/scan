import { errorMessage } from '../../lib/errors';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { fromFormValues, ReceiptForm, type ReceiptFormValues, toFormValues, validateForm } from '../../components/ReceiptForm';
import { ReceiptPhoto } from '../../components/ReceiptPhoto';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeaderTextButton } from '../../components/ui/HeaderButton';
import { ListRow, ListSection } from '../../components/ui/List';
import { confirmDestructive } from '../../lib/actionSheet';
import { showAlert } from '../../lib/alert';
import { confirmIfDuplicate } from '../../lib/confirmDuplicate';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import {
  deleteReceipt,
  getReceipt,
  getReceiptImageUrl,
  recordToData,
  updateReceipt,
} from '../../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../../types/receipt';

/** Kaydedilmiş bir fişi görüntüle, düzenle ya da sil. */
export default function ReceiptDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [record, setRecord] = useState<ReceiptRecord | null>(null);
  const [initial, setInitial] = useState<ReceiptFormValues | null>(null);
  const [values, setValues] = useState<ReceiptFormValues | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getReceipt(id)
      .then(async (r) => {
        const v = toFormValues(recordToData(r));
        setRecord(r);
        setInitial(v);
        setValues(v);
        if (r.image_path) setImageUrl(await getReceiptImageUrl(r.image_path, 3600));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  const dirty = useMemo(() => !!values && !!initial && JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);

  async function save() {
    if (!values || !record) return;
    const errors = validateForm(values);
    if (errors.length) {
      haptics.error();
      showAlert('Lütfen kontrol edin', errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const data = fromFormValues(values);
      // Yalnızca tarih ya da tutar değiştiyse mükerrer kontrolü yap
      const keyChanged = !!initial && (values.tarih !== initial.tarih || values.toplamTutar !== initial.toplamTutar);
      if (keyChanged && !(await confirmIfDuplicate(data, record.id))) return;
      await updateReceipt(record.id, data);
      router.back();
      showToast('Değişiklikler kaydedildi');
    } catch (e) {
      haptics.error();
      showAlert('Kaydedilemedi', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!record) return;
    confirmDestructive(record.firma_adi, 'Bu fiş ve fotoğrafı kalıcı olarak silinecek.', 'Fişi Sil', async () => {
      try {
        await deleteReceipt(record);
        router.back();
        showToast('Fiş silindi', 'info');
      } catch (e) {
        showAlert('Silinemedi', errorMessage(e));
      }
    });
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
        <EmptyState icon={{ sf: 'exclamationmark.triangle', ion: 'warning-outline' }} title="Fiş Açılamadı" message={error} />
      </View>
    );
  }

  if (!values || !record) return <ActivityIndicator style={{ marginTop: 120 }} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (saving ? <ActivityIndicator /> : <HeaderTextButton title="Kaydet" bold onPress={save} disabled={!dirty} />),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        {record.image_path && <ReceiptPhoto uri={imageUrl} />}
        <ReceiptForm values={values} onChange={setValues} />
        <ListSection>
          <ListRow title="Fişi Sil" tone="destructive" onPress={remove} disabled={saving} />
        </ListSection>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
