import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput } from 'react-native';

import { HeaderTextButton } from '../components/ui/HeaderButton';
import { FieldRow, ListRow, ListSection } from '../components/ui/List';
import { showAlert } from '../lib/alert';
import { setMonthlyBudget, useMonthlyBudget } from '../lib/budget';
import { amountToInput, parseAmount } from '../lib/format';
import { haptics } from '../lib/haptics';
import { fontFamily, tabular, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { useSingleFlight } from '../hooks/useSingleFlight';

/** Aylık gider bütçesi: ana sayfadaki özet kartında ne kadarının kullanıldığı gösterilir. */
export default function BudgetScreen() {
  const theme = useTheme();
  const runOnce = useSingleFlight();
  const budget = useMonthlyBudget();
  const [text, setText] = useState<string | null>(null);
  const value = text ?? (budget ? amountToInput(budget).replace(/,00$/, '') : '');

  async function save() {
    await runOnce(async () => {
      const amount = parseAmount(value);
      if (!(amount > 0)) {
        haptics.error();
        showAlert('Geçersiz tutar', 'Aylık bütçe için sıfırdan büyük bir tutar girin.');
        return;
      }
      await setMonthlyBudget(amount);
      haptics.success();
      router.back();
      showToast('Bütçe kaydedildi');
    });
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderTextButton title="Vazgeç" onPress={() => router.back()} />,
          headerRight: () => <HeaderTextButton title="Kaydet" bold onPress={save} />,
        }}
      />
      <ListSection footer="Ana sayfada, aylık görünümde bütçenin ne kadarının kullanıldığı gösterilir. %80'i geçince turuncu, aşılınca kırmızı olur. Bu ayar yalnızca bu cihazda saklanır.">
        <FieldRow label="Aylık (₺)">
          <TextInput
            value={value}
            onChangeText={setText}
            placeholder="ör. 15.000"
            placeholderTextColor={theme.tertiaryLabel}
            keyboardType="decimal-pad"
            autoFocus
            selectTextOnFocus
            onSubmitEditing={save}
            style={[t.body, tabular, styles.input, { color: theme.label }]}
          />
        </FieldRow>
      </ListSection>
      {budget && (
        <ListSection>
          <ListRow
            title="Bütçeyi Kaldır"
            tone="destructive"
            onPress={async () => {
              await setMonthlyBudget(null);
              router.back();
              showToast('Bütçe kaldırıldı', 'info');
            }}
          />
        </ListSection>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: { textAlign: 'right', alignSelf: 'stretch', minHeight: 44, fontFamily, ...Platform.select({ web: { outlineWidth: 0 } }) },
});
