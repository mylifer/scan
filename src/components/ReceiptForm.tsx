import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { showActionSheet } from '../lib/actionSheet';
import { formatTL, normalizeTrDate, parseAmount, round2, todayTr } from '../lib/format';
import { formWarnings, type ReceiptFormValues, setFormField } from '../lib/receiptForm';
import { haptics } from '../lib/haptics';
import { categoryMeta, fontFamily, tabular, type as t, useTheme } from '../lib/theme';
import { KATEGORILER, type ReceiptField } from '../types/receipt';
import { Icon } from './ui/Icon';
import { FieldRow, ListRow, ListSection } from './ui/List';

export { emptyForm, formWarnings, fromFormValues, type ReceiptFormValues, toFormValues, validateForm } from '../lib/receiptForm';

interface Props {
  values: ReceiptFormValues;
  onChange: (values: ReceiptFormValues) => void;
}

export function ReceiptForm({ values, onChange }: Props) {
  const theme = useTheme();
  const set = <K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) => onChange(setFormField(values, key, value));
  const unsure = (f: ReceiptField) => values.belirsiz?.includes(f) ?? false;
  const toplamKdv = round2(parseAmount(values.kdvYuzde1) + parseAmount(values.kdvYuzde10) + parseAmount(values.kdvYuzde20));
  const kdvTooHigh = toplamKdv > parseAmount(values.toplamTutar) && parseAmount(values.toplamTutar) > 0;
  const meta = categoryMeta[values.kategori];

  function pickCategory() {
    showActionSheet({
      title: 'Kategori',
      options: KATEGORILER.map((k) => ({
        label: categoryMeta[k].label,
        onPress: () => {
          haptics.select();
          set('kategori', k);
        },
      })),
    });
  }

  const warnings = formWarnings(values);

  return (
    <>
      {!!values.belirsiz?.length && (
        <View style={[styles.warning, { backgroundColor: theme.dark ? 'rgba(255,159,10,0.16)' : 'rgba(255,149,0,0.12)' }]}>
          <Icon sf="questionmark.circle.fill" ion="help-circle" size={18} color={theme.orange} />
          <Text style={[t.subhead, { color: theme.label, flex: 1 }]}>
            Turuncu işaretli {values.belirsiz.length === 1 ? 'alan' : `${values.belirsiz.length} alan`} fişte net okunamadı. Fişle karşılaştırıp gerekirse düzeltin.
          </Text>
        </View>
      )}
      {warnings.length > 0 && (
        <View style={[styles.warning, { backgroundColor: theme.dark ? 'rgba(255,159,10,0.16)' : 'rgba(255,149,0,0.12)' }]}>
          <Icon sf="exclamationmark.triangle.fill" ion="warning" size={18} color={theme.orange} />
          <View style={{ flex: 1, gap: 4 }}>
            {warnings.map((w) => (
              <Text key={w} style={[t.subhead, { color: theme.label }]}>
                {w}
              </Text>
            ))}
          </View>
        </View>
      )}
      <ListSection header="Fiş">
        <FieldRow label="Firma" highlight={unsure('firmaAdi')}>
          <Input value={values.firmaAdi} onChangeText={(v) => set('firmaAdi', v)} placeholder="Firma adı" autoCapitalize="characters" />
        </FieldRow>
        <FieldRow label="Tarih" highlight={unsure('tarih')}>
          <DateField value={values.tarih} onChange={(v) => set('tarih', v)} />
        </FieldRow>
        <ListRow
          title="Kategori"
          icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
          value={meta.label}
          valueColor={unsure('kategori') ? theme.orange : undefined}
          chevron
          onPress={pickCategory}
        />
      </ListSection>

      <ListSection header="Tutar (₺)">
        <FieldRow label="Toplam" highlight={unsure('toplamTutar')}>
          <AmountInput value={values.toplamTutar} onChangeText={(v) => set('toplamTutar', v)} bold />
        </FieldRow>
      </ListSection>

      <ListSection
        header="KDV (₺)"
        footer={
          <Text style={[t.footnote, styles.footer, { color: kdvTooHigh ? theme.red : theme.secondaryLabel }]}>
            {kdvTooHigh ? 'Toplam KDV, toplam tutardan büyük. TOPLAM ile TOPKDV karışmış olabilir.' : `Toplam KDV: ${formatTL(toplamKdv)}`}
          </Text>
        }>
        <FieldRow label="%1" highlight={unsure('kdvYuzde1')}>
          <AmountInput value={values.kdvYuzde1} onChangeText={(v) => set('kdvYuzde1', v)} />
        </FieldRow>
        <FieldRow label="%10" highlight={unsure('kdvYuzde10')}>
          <AmountInput value={values.kdvYuzde10} onChangeText={(v) => set('kdvYuzde10', v)} />
        </FieldRow>
        <FieldRow label="%20" highlight={unsure('kdvYuzde20')}>
          <AmountInput value={values.kdvYuzde20} onChangeText={(v) => set('kdvYuzde20', v)} />
        </FieldRow>
      </ListSection>
    </>
  );
}

function Input(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.tertiaryLabel}
      style={[t.body, styles.input, { color: theme.label }, props.style]}
    />
  );
}

function AmountInput({ bold, ...props }: TextInputProps & { bold?: boolean }) {
  return (
    <Input
      {...props}
      keyboardType="decimal-pad"
      selectTextOnFocus
      placeholder="0,00"
      style={[tabular, bold && { fontWeight: '600' }]}
    />
  );
}

/** iOS'ta sistem tarih seçicisi (kompakt), web'de GG.AA.YYYY metin alanı */
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  if (Platform.OS !== 'ios') {
    return <Input value={value} onChangeText={onChange} placeholder="GG.AA.YYYY" keyboardType="numbers-and-punctuation" />;
  }
  const normalized = normalizeTrDate(value) ?? todayTr();
  const [d, m, y] = normalized.split('.').map(Number);
  return (
    <DateTimePicker
      value={new Date(y, m - 1, d, 12)}
      mode="date"
      display="compact"
      locale="tr-TR"
      maximumDate={new Date()}
      onChange={(_, date) => {
        if (!date) return;
        const pad = (n: number) => String(n).padStart(2, '0');
        onChange(`${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`);
      }}
      style={{ marginRight: -8 }}
    />
  );
}

const styles = StyleSheet.create({
  input: { textAlign: 'right', paddingVertical: 11, minWidth: 120, width: '100%', fontFamily, ...Platform.select({ web: { outlineWidth: 0 } }) },
  footer: { marginHorizontal: 16, marginTop: 7 },
  warning: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20, padding: 12, borderRadius: 12 },
});
