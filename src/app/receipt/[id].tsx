import { errorMessage } from '../../lib/errors';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { fromFormValues, ReceiptForm, type ReceiptFormValues, toFormValues, validateForm } from '../../components/ReceiptForm';
import { ReceiptPhoto } from '../../components/ReceiptPhoto';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeaderTextButton } from '../../components/ui/HeaderButton';
import { ListRow, ListSection } from '../../components/ui/List';
import { confirmDestructive, showActionSheet } from '../../lib/actionSheet';
import { showAlert } from '../../lib/alert';
import { confirmIfDuplicate } from '../../lib/confirmDuplicate';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../lib/theme';
import { shareReceipt } from '../../services/export/shareReceipt';
import { prepareArchiveImage } from '../../services/image/prepareReceiptImages';
import { showToast } from '../../lib/toast';
import {
  attachReceiptImage,
  deleteReceipt,
  getReceipt,
  getReceiptImageUrl,
  recordToData,
  updateReceipt,
} from '../../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../../types/receipt';
import { useSingleFlight } from '../../hooks/useSingleFlight';

/** Kaydedilmiş bir fişi görüntüle, düzenle ya da sil. */
export default function ReceiptDetailScreen() {
  const theme = useTheme();
  const runOnce = useSingleFlight();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [record, setRecord] = useState<ReceiptRecord | null>(null);
  const [initial, setInitial] = useState<ReceiptFormValues | null>(null);
  const [values, setValues] = useState<ReceiptFormValues | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [sharing, setSharing] = useState(false);

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
    await runOnce(async () => {
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
    });
  }

  function choosePhoto() {
    showActionSheet({
      title: record?.image_path ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle',
      options: [
        { label: 'Fotoğraf Çek', onPress: () => attachFrom('camera') },
        { label: 'Galeriden Seç', onPress: () => attachFrom('library') },
      ],
    });
  }

  async function attachFrom(source: 'camera' | 'library') {
    if (!record) return;
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast(source === 'camera' ? 'Kamera izni verilmedi' : 'Galeri izni verilmedi', 'error');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets.length) return;
    const asset = result.assets[0];
    setAttaching(true);
    try {
      const updated = await attachReceiptImage(record, await prepareArchiveImage(asset.uri, asset.width || 3000));
      setRecord(updated);
      if (updated.image_path) setImageUrl(await getReceiptImageUrl(updated.image_path, 3600));
      haptics.success();
      showToast('Fotoğraf eklendi');
    } catch (e) {
      haptics.error();
      showAlert('Fotoğraf eklenemedi', errorMessage(e));
    } finally {
      setAttaching(false);
    }
  }

  async function share() {
    if (!record) return;
    setSharing(true);
    try {
      if ((await shareReceipt(record)) === 'copied') showToast('Fiş bilgileri panoya kopyalandı', 'info');
    } catch (e) {
      showAlert('Paylaşılamadı', errorMessage(e));
    } finally {
      setSharing(false);
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
          <ListRow
            title="Paylaş"
            subtitle={dirty ? 'Kaydedilmiş hâli paylaşılır' : undefined}
            tone="action"
            icon={{ sf: 'square.and.arrow.up', ion: 'share-outline', color: theme.blue }}
            onPress={share}
            disabled={sharing}
            accessory={sharing ? <ActivityIndicator /> : undefined}
          />
          <ListRow
            title={record.image_path ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
            tone="action"
            icon={{ sf: 'camera.fill', ion: 'camera', color: theme.blue }}
            onPress={choosePhoto}
            disabled={saving || attaching}
            accessory={attaching ? <ActivityIndicator /> : undefined}
          />
        </ListSection>
        <ListSection>
          <ListRow title="Fişi Sil" tone="destructive" onPress={remove} disabled={saving} />
        </ListSection>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
