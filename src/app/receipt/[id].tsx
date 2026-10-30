import { errorMessage } from '../../lib/errors';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';

import { fromFormValues, ReceiptForm, type ReceiptFormValues, toFormValues, validateForm } from '../../components/ReceiptForm';
import { ReceiptPhoto } from '../../components/ReceiptPhoto';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeaderTextButton } from '../../components/ui/HeaderButton';
import { ListRow, ListSection } from '../../components/ui/List';
import { Badge } from '../../components/web/Badge';
import { WebButton } from '../../components/web/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/web/Card';
import { WebPageHeader } from '../../components/web/PageHeader';
import { WebSwitch } from '../../components/web/Switch';
import { confirmDestructive, showActionSheet } from '../../lib/actionSheet';
import { showAlert } from '../../lib/alert';
import { confirmIfDuplicate } from '../../lib/confirmDuplicate';
import { formatTL, parseAmount, shortTrDate } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { useWide } from '../../lib/layout';
import { categoryMeta, fontFamily, useShadcnTheme, useTheme } from '../../lib/theme';
import { shareReceipt } from '../../services/export/shareReceipt';
import { prepareArchiveImage } from '../../services/image/prepareReceiptImages';
import { showToast } from '../../lib/toast';
import {
  attachReceiptImage,
  deleteReceipt,
  getReceipt,
  getReceiptImageUrl,
  markReceiptsSent,
  recordToData,
  updateReceipt,
} from '../../services/supabase/receiptsRepository';
import { reportError } from '../../services/errorLog';
import { trashReady } from '../../services/supabase/schema';
import type { ReceiptRecord } from '../../types/receipt';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { useConfirmLeave } from '../../hooks/useConfirmLeave';

/** Kaydedilmiş bir fişi görüntüle, düzenle ya da sil. */
export default function ReceiptDetailScreen() {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
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
  const [marking, setMarking] = useState(false);

  /** Muhasebeciye gönderildi işaretini açar/kapatır (formdaki kaydedilmemiş değişikliklerden bağımsız) */
  async function toggleSent(on: boolean) {
    if (!record) return;
    setMarking(true);
    try {
      await markReceiptsSent([record.id], on);
      setRecord({ ...record, muhasebe_gonderildi_at: on ? new Date().toISOString() : null });
      haptics.success();
      showToast(on ? 'Muhasebeciye gönderildi olarak işaretlendi' : 'Gönderildi işareti kaldırıldı', 'info');
    } catch (e) {
      haptics.error();
      showAlert('İşaretlenemedi', errorMessage(e));
    } finally {
      setMarking(false);
    }
  }

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
  const allowLeave = useConfirmLeave(dirty);

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
        // Yalnızca tarih, tutar, fiş no ya da VKN değiştiyse mükerrer kontrolü yap
        const keyChanged =
          !!initial &&
          (values.tarih !== initial.tarih || values.toplamTutar !== initial.toplamTutar || values.fisNo !== initial.fisNo || values.vkn !== initial.vkn);
        if (keyChanged && !(await confirmIfDuplicate(data, record.id))) return;
        await updateReceipt(record.id, data);
        // Muhasebeciye gönderilmiş fişin tutarı/tarihi değiştiyse: düzeltilmiş hâli de gönderilsin mi?
        const amountsChanged =
          !!initial &&
          (keyChanged || values.kdvYuzde1 !== initial.kdvYuzde1 || values.kdvYuzde10 !== initial.kdvYuzde10 || values.kdvYuzde20 !== initial.kdvYuzde20);
        if (record.muhasebe_gonderildi_at && amountsChanged) await askResend(record.id);
        allowLeave();
        router.back();
        showToast('Değişiklikler kaydedildi');
      } catch (e) {
        haptics.error();
        reportError('fiş güncelleme', e);
        showAlert('Kaydedilemedi', errorMessage(e));
      } finally {
        setSaving(false);
      }
    });
  }

  /** Gönderilmiş fiş düzeltildi: işaret kaldırılırsa sonraki dışa aktarıma tekrar girer */
  function askResend(id: string): Promise<void> {
    return new Promise((resolve) => {
      showActionSheet({
        title: 'Bu fiş muhasebeciye gönderilmişti',
        message: 'Düzeltilmiş hâlinin de gönderilmesi için "gönderildi" işaretini kaldırabilirsiniz; fiş bir sonraki dışa aktarıma girer.',
        options: [
          {
            label: 'İşareti Kaldır',
            onPress: () => {
              markReceiptsSent([id], false)
                .catch((e) => showAlert('İşaret kaldırılamadı', errorMessage(e)))
                .finally(resolve);
            },
          },
        ],
        cancelLabel: 'Gönderildi Kalsın',
        onCancel: resolve,
      });
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

  async function remove() {
    if (!record) return;
    const trash = (await trashReady()) === true;
    const message = trash
      ? 'Fiş Son Silinenler’e taşınacak; 30 gün içinde Ayarlar’dan geri alabilirsiniz.'
      : 'Bu fiş ve fotoğrafı kalıcı olarak silinecek.';
    confirmDestructive(record.firma_adi, message, 'Fişi Sil', async () => {
      try {
        const result = await deleteReceipt(record);
        allowLeave();
        router.back();
        showToast(result === 'trash' ? 'Fiş Son Silinenler’e taşındı' : 'Fiş silindi', 'info');
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

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 1100, width: '100%', gap: 24 }}>
            <WebPageHeader
              title={values.firmaAdi || record.firma_adi || 'Fiş Detayı'}
              description={`${formatTL(parseAmount(values.toplamTutar))} · ${shortTrDate(values.tarih || record.tarih)} · ${categoryMeta(values.kategori).label}`}
              onBack={() => router.back()}
              badge={
                record.muhasebe_gonderildi_at ? (
                  <Badge variant="secondary">Muhasebeye Gönderildi</Badge>
                ) : undefined
              }
              actions={
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <WebButton
                    variant="outline"
                    icon={{ sf: 'square.and.arrow.up', ion: 'share-outline' }}
                    onPress={share}
                    loading={sharing}>
                    Paylaş
                  </WebButton>
                  <WebButton
                    variant="outline"
                    icon={{ sf: 'camera.fill', ion: 'camera' }}
                    onPress={choosePhoto}
                    loading={attaching}>
                    {record.image_path ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
                  </WebButton>
                  <WebButton
                    variant="destructive"
                    icon={{ sf: 'trash.fill', ion: 'trash' }}
                    onPress={remove}
                    disabled={saving}>
                    Fişi Sil
                  </WebButton>
                  <WebButton
                    variant="default"
                    icon={{ sf: 'checkmark', ion: 'checkmark' }}
                    onPress={save}
                    disabled={!dirty}
                    loading={saving}>
                    Kaydet
                  </WebButton>
                </View>
              }
            />

            <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 20 }}>
                {record.image_path ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Fiş Fotoğrafı</CardTitle>
                      <CardDescription>Orijinal taranan fiş görüntüsü.</CardDescription>
                    </CardHeader>
                    <CardContent style={{ alignItems: 'center' }}>
                      <ReceiptPhoto uri={imageUrl} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Fiş Fotoğrafı</CardTitle>
                      <CardDescription>Bu fişe henüz bir fotoğraf eklenmedi.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <WebButton variant="outline" icon={{ sf: 'camera.fill', ion: 'camera' }} onPress={choosePhoto}>
                        Fotoğraf Ekle
                      </WebButton>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Muhasebe Durumu</CardTitle>
                    <CardDescription>
                      Muhasebeciye gönderilen fişleri işaretleyin; dışa aktarırken hariç tutabilirsiniz.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                      <View style={{ gap: 2, flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontFamily, fontSize: 13, fontWeight: '600', color: st.cardForeground }}>
                          Muhasebeciye Gönderildi
                        </Text>
                        <Text style={{ fontFamily, fontSize: 12, color: st.mutedForeground }}>
                          {record.muhasebe_gonderildi_at
                            ? `${sentLabel(record.muhasebe_gonderildi_at)} tarihinde işaretlendi`
                            : 'Henüz gönderilmedi'}
                        </Text>
                      </View>
                      <WebSwitch
                        checked={!!record.muhasebe_gonderildi_at}
                        onCheckedChange={toggleSent}
                        disabled={marking}
                        accessibilityLabel="Muhasebeciye gönderildi"
                      />
                    </View>
                  </CardContent>
                </Card>
              </View>

              <View style={{ flex: 1.4 }}>
                <ReceiptForm values={values} onChange={setValues} />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

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
        <ListSection
          footer={
            record.muhasebe_gonderildi_at
              ? 'Dışa aktarırken "Gönderilenleri hariç tut" açıksa bu fiş tekrar aktarılmaz.'
              : 'Muhasebeciye gönderdiğiniz fişleri işaretleyin; sonraki dışa aktarımda hariç tutabilirsiniz.'
          }>
          <ListRow
            title="Muhasebeciye Gönderildi"
            subtitle={record.muhasebe_gonderildi_at ? sentLabel(record.muhasebe_gonderildi_at) : undefined}
            icon={{ sf: 'paperplane.fill', ion: 'paper-plane', color: theme.green }}
            accessory={
              marking ? (
                <ActivityIndicator />
              ) : (
                <Switch value={!!record.muhasebe_gonderildi_at} onValueChange={toggleSent} accessibilityLabel="Muhasebeciye gönderildi" />
              )
            }
          />
        </ListSection>
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

/** "12 Ekim 2026" */
function sentLabel(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}
