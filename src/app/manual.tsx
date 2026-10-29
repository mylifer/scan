import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { emptyForm, fromFormValues, ReceiptForm, type ReceiptFormValues, toFormValues, validateForm } from '../components/ReceiptForm';
import { HeaderTextButton } from '../components/ui/HeaderButton';
import { ListRow, ListSection } from '../components/ui/List';
import { showAlert } from '../lib/alert';
import { confirmIfDuplicate } from '../lib/confirmDuplicate';
import { errorMessage } from '../lib/errors';
import type { GibQrData } from '../lib/gibQr';
import { haptics } from '../lib/haptics';
import { takePendingQr } from '../lib/pendingQr';
import { type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { reportError } from '../services/errorLog';
import { pdfPickerAvailable, pickInvoicePdf } from '../services/invoice/pickInvoicePdf';
import { applyLearnedCategory, findFirmByVkn, saveReceipt } from '../services/supabase/receiptsRepository';
import { getVisionService, VisionServiceError } from '../services/vision';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { useConfirmLeave } from '../hooks/useConfirmLeave';
import type { ReceiptData, ReceiptField } from '../types/receipt';

/**
 * Fotoğrafsız fiş ekleme: e-posta ile gelen e-Arşiv faturaları ya da kaybolan fişler için.
 * Form elle doldurulabilir, faturanın PDF'inden (yapay zekâ) ya da karekodundan (kesin değerler) doldurulabilir.
 */
export default function ManualReceiptScreen() {
  const theme = useTheme();
  const runOnce = useSingleFlight();
  const [initial] = useState<ReceiptFormValues>(emptyForm);
  const [values, setValues] = useState<ReceiptFormValues>(initial);
  const allowLeave = useConfirmLeave(JSON.stringify(values) !== JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState<'pdf' | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const canPickPdf = pdfPickerAvailable();
  // Canlı karekod okuma telefonda (web sürümünde kamera telefonun kendi uygulamasıyla açılıyor)
  const canScanQr = Platform.OS !== 'web';

  // Ana ekran kısayolundan (?qr=1) gelindiyse doğrudan karekod okuyucuyu aç
  const { qr: openQr } = useLocalSearchParams<{ qr?: string }>();
  useEffect(() => {
    if (openQr !== '1' || !canScanQr) return;
    router.setParams({ qr: undefined });
    router.push('/qr');
  }, [openQr, canScanQr]);

  // Karekod ekranından dönülünce formu doldur
  useFocusEffect(
    useCallback(() => {
      const qr = takePendingQr();
      if (!qr) return;
      void qrToForm(qr).then(({ data, source }) => {
        // Kullanıcının daha önce yazdığı not ve etiketler korunur
        setValues((v) => ({ ...toFormValues(data), notlar: v.notlar, etiketler: v.etiketler }));
        setSource(source);
      });
    }, []),
  );

  async function fillFromPdf() {
    let pdf: Awaited<ReturnType<typeof pickInvoicePdf>>;
    try {
      pdf = await pickInvoicePdf();
    } catch (e) {
      showAlert('PDF açılamadı', errorMessage(e));
      return;
    }
    if (!pdf) return;
    setFilling('pdf');
    try {
      const read = await getVisionService().analyzeReceipt({ base64: pdf.base64, mimeType: 'application/pdf' });
      const { data } = await applyLearnedCategory(read);
      setValues((v) => ({ ...toFormValues(data), notlar: v.notlar, etiketler: v.etiketler }));
      setSource(`“${pdf.name}” okundu. Bilgileri faturayla karşılaştırıp kaydedin.`);
      haptics.success();
    } catch (e) {
      haptics.error();
      if (!(e instanceof VisionServiceError && e.kind !== 'other')) reportError('PDF fatura okuma', e);
      showAlert('Fatura okunamadı', errorMessage(e));
    } finally {
      setFilling(null);
    }
  }

  async function save() {
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
        await saveReceipt(data);
        haptics.success();
        allowLeave();
        router.back();
        showToast('Fiş kaydedildi');
      } catch (e) {
        haptics.error();
        reportError('elle fiş kaydetme', e);
        showAlert('Kaydedilemedi', errorMessage(e));
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderTextButton title="Vazgeç" onPress={() => router.back()} />,
          headerRight: () => (saving ? <ActivityIndicator /> : <HeaderTextButton title="Kaydet" bold onPress={save} disabled={!!filling} />),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        {(canPickPdf || canScanQr) && (
          <ListSection
            header="e-Arşiv / e-Fatura"
            footer={source ?? 'Mailden gelen faturanın PDF’ini seçin ya da faturadaki karekodu okutun; form kendiliğinden dolar.'}>
            {canPickPdf ? (
              <ListRow
                title="PDF’ten Doldur"
                icon={{ sf: 'doc.richtext.fill', ion: 'document-text', color: theme.red }}
                onPress={fillFromPdf}
                disabled={!!filling || saving}
                accessory={filling === 'pdf' ? <ActivityIndicator /> : undefined}
                chevron={filling !== 'pdf'}
              />
            ) : null}
            {canScanQr ? (
              <ListRow
                title="Karekodu Okut"
                icon={{ sf: 'qrcode.viewfinder', ion: 'qr-code', color: theme.indigo }}
                onPress={() => router.push('/qr')}
                disabled={!!filling || saving}
                chevron
              />
            ) : null}
          </ListSection>
        )}
        {!canPickPdf && !canScanQr && (
          <Text style={[t.footnote, { color: theme.secondaryLabel, marginHorizontal: 32, marginBottom: 12 }]}>
            Fotoğrafı olmayan fişler için (ör. e-posta ile gelen e-Arşiv faturası). Bilgileri fişteki gibi girin.
          </Text>
        )}
        <ReceiptForm values={values} onChange={setValues} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Karekod verisini forma çevirir; firma adı ve kategori bu VKN ile kaydedilen önceki fişten alınır */
async function qrToForm(qr: GibQrData): Promise<{ data: ReceiptData; source: string }> {
  const firm = await findFirmByVkn(qr.vkn).catch(() => null);
  const unsure: ReceiptField[] = [];
  if (!firm) unsure.push('firmaAdi', 'kategori');
  if (qr.paraBirimi !== 'TRY') unsure.push('toplamTutar', 'kdvYuzde1', 'kdvYuzde10', 'kdvYuzde20');
  const data: ReceiptData = {
    firmaAdi: firm?.firma_adi ?? '',
    tarih: qr.tarih,
    toplamTutar: qr.toplamTutar,
    kdvYuzde1: qr.kdvYuzde1,
    kdvYuzde10: qr.kdvYuzde10,
    kdvYuzde20: qr.kdvYuzde20,
    kategori: firm?.kategori ?? 'diğer',
    ...(qr.faturaNo ? { fisNo: qr.faturaNo } : {}),
    vkn: qr.vkn,
    ...(unsure.length ? { eminOlunmayanlar: unsure } : {}),
  };
  const source = [
    'Karekoddan dolduruldu.',
    firm ? 'Firma adı ve kategori, bu VKN ile kaydettiğiniz önceki fişten alındı.' : 'Karekodda firma adı yok: faturadaki satıcı adını yazın.',
    qr.paraBirimi !== 'TRY' ? `Fatura ${qr.paraBirimi} cinsinden: tutarları TL’ye çevirip girin.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { data, source };
}
