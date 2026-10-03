import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { emptyForm, fromFormValues, ReceiptForm, type ReceiptFormValues, validateForm } from '../components/ReceiptForm';
import { HeaderTextButton } from '../components/ui/HeaderButton';
import { showAlert } from '../lib/alert';
import { confirmIfDuplicate } from '../lib/confirmDuplicate';
import { errorMessage } from '../lib/errors';
import { haptics } from '../lib/haptics';
import { type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { saveReceipt } from '../services/supabase/receiptsRepository';
import { useSingleFlight } from '../hooks/useSingleFlight';

/** Fotoğrafsız fiş ekleme: e-posta ile gelen e-Arşiv faturaları ya da kaybolan fişler için. */
export default function ManualReceiptScreen() {
  const theme = useTheme();
  const runOnce = useSingleFlight();
  const [values, setValues] = useState<ReceiptFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);

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
        router.back();
        showToast('Fiş kaydedildi');
      } catch (e) {
        haptics.error();
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
          headerRight: () => (saving ? <ActivityIndicator /> : <HeaderTextButton title="Kaydet" bold onPress={save} />),
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        <Text style={[t.footnote, { color: theme.secondaryLabel, marginHorizontal: 32, marginBottom: 12 }]}>
          Fotoğrafı olmayan fişler için (ör. e-posta ile gelen e-Arşiv faturası). Bilgileri fişteki gibi girin.
        </Text>
        <ReceiptForm values={values} onChange={setValues} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
