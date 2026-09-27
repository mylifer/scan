import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import { showActionSheet } from '../lib/actionSheet';
import { amountToInput, formatTL, normalizeTrDate, parseAmount, round2, todayTr } from '../lib/format';
import { haptics } from '../lib/haptics';
import { categoryMeta, fontFamily, tabular, type as t, useTheme } from '../lib/theme';
import { KATEGORILER, type ReceiptData } from '../types/receipt';
import { FieldRow, ListRow, ListSection } from './ui/List';

/** Formda tutarlar metin olarak tutulur ki kullanıcı "12,5" gibi ara değerler yazabilsin. */
export interface ReceiptFormValues {
  firmaAdi: string;
  tarih: string;
  toplamTutar: string;
  kdvYuzde1: string;
  kdvYuzde10: string;
  kdvYuzde20: string;
  kategori: ReceiptData['kategori'];
}

export function toFormValues(d: ReceiptData): ReceiptFormValues {
  return {
    firmaAdi: d.firmaAdi,
    tarih: d.tarih,
    toplamTutar: amountToInput(d.toplamTutar),
    kdvYuzde1: amountToInput(d.kdvYuzde1),
    kdvYuzde10: amountToInput(d.kdvYuzde10),
    kdvYuzde20: amountToInput(d.kdvYuzde20),
    kategori: d.kategori,
  };
}

export const EMPTY_FORM: ReceiptFormValues = {
  firmaAdi: '',
  tarih: todayTr(),
  toplamTutar: '',
  kdvYuzde1: '0,00',
  kdvYuzde10: '0,00',
  kdvYuzde20: '0,00',
  kategori: 'ofis gideri',
};

export function fromFormValues(v: ReceiptFormValues): ReceiptData {
  return {
    firmaAdi: v.firmaAdi.trim(),
    tarih: normalizeTrDate(v.tarih) ?? v.tarih.trim(),
    toplamTutar: parseAmount(v.toplamTutar),
    kdvYuzde1: parseAmount(v.kdvYuzde1),
    kdvYuzde10: parseAmount(v.kdvYuzde10),
    kdvYuzde20: parseAmount(v.kdvYuzde20),
    kategori: v.kategori,
  };
}

/** Kaydetmeden önce kontrol; hata yoksa boş dizi döner. */
export function validateForm(v: ReceiptFormValues): string[] {
  const d = fromFormValues(v);
  const errors: string[] = [];
  if (!d.firmaAdi) errors.push('Firma adı boş olamaz.');
  if (!normalizeTrDate(v.tarih)) errors.push('Tarih GG.AA.YYYY biçiminde olmalı.');
  if (d.toplamTutar <= 0) errors.push('Toplam tutar 0’dan büyük olmalı.');
  if (d.kdvYuzde1 + d.kdvYuzde10 + d.kdvYuzde20 > d.toplamTutar) {
    errors.push('Toplam KDV, toplam tutardan büyük olamaz. TOPLAM ile TOPKDV karışmış olabilir.');
  }
  return errors;
}

interface Props {
  values: ReceiptFormValues;
  onChange: (values: ReceiptFormValues) => void;
}

export function ReceiptForm({ values, onChange }: Props) {
  const theme = useTheme();
  const set = <K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) => onChange({ ...values, [key]: value });
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

  return (
    <>
      <ListSection header="Fiş">
        <FieldRow label="Firma">
          <Input value={values.firmaAdi} onChangeText={(v) => set('firmaAdi', v)} placeholder="Firma adı" autoCapitalize="characters" />
        </FieldRow>
        <FieldRow label="Tarih">
          <DateField value={values.tarih} onChange={(v) => set('tarih', v)} />
        </FieldRow>
        <ListRow
          title="Kategori"
          icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
          value={meta.label}
          chevron
          onPress={pickCategory}
        />
      </ListSection>

      <ListSection header="Tutar (₺)">
        <FieldRow label="Toplam">
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
        <FieldRow label="%1">
          <AmountInput value={values.kdvYuzde1} onChangeText={(v) => set('kdvYuzde1', v)} />
        </FieldRow>
        <FieldRow label="%10">
          <AmountInput value={values.kdvYuzde10} onChangeText={(v) => set('kdvYuzde10', v)} />
        </FieldRow>
        <FieldRow label="%20">
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
});
