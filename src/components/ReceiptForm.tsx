import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { amountToInput, formatTL, normalizeTrDate, parseAmount, round2 } from '../lib/format';
import { colors, kategoriMeta } from '../lib/theme';
import { KATEGORILER, type ReceiptData } from '../types/receipt';

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
  if (!normalizeTrDate(v.tarih)) errors.push('Tarih DD.MM.YYYY formatında olmalı.');
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
  const set = <K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const toplamKdv = round2(
    parseAmount(values.kdvYuzde1) + parseAmount(values.kdvYuzde10) + parseAmount(values.kdvYuzde20),
  );

  return (
    <View style={styles.card}>
      <Field label="Firma adı" value={values.firmaAdi} onChangeText={(t) => set('firmaAdi', t)} />
      <Field
        label="Tarih (GG.AA.YYYY)"
        value={values.tarih}
        onChangeText={(t) => set('tarih', t)}
        keyboardType="numbers-and-punctuation"
        placeholder="31.12.2026"
      />
      <AmountField label="Toplam tutar (₺)" value={values.toplamTutar} onChangeText={(t) => set('toplamTutar', t)} />

      <Text style={styles.section}>KDV tutarları</Text>
      <View style={styles.row}>
        <AmountField label="%1" value={values.kdvYuzde1} onChangeText={(t) => set('kdvYuzde1', t)} compact />
        <AmountField label="%10" value={values.kdvYuzde10} onChangeText={(t) => set('kdvYuzde10', t)} compact />
        <AmountField label="%20" value={values.kdvYuzde20} onChangeText={(t) => set('kdvYuzde20', t)} compact />
      </View>
      <View style={styles.kdvTotal}>
        <Text style={styles.kdvTotalLabel}>Toplam KDV</Text>
        <Text style={styles.kdvTotalValue}>{formatTL(toplamKdv)}</Text>
      </View>

      <Text style={styles.section}>Kategori</Text>
      <View style={styles.chips}>
        {KATEGORILER.map((k) => {
          const active = values.kategori === k;
          return (
            <Pressable
              key={k}
              onPress={() => set('kategori', k)}
              style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text style={[styles.chipText, active && { color: '#fff' }]}>
                {kategoriMeta[k].emoji} {k}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={colors.muted}
        style={[styles.input, focused && { borderColor: colors.primary }, style]}
      />
    </View>
  );
}

function AmountField({ compact, ...props }: TextInputProps & { label: string; compact?: boolean }) {
  return (
    <Field
      {...props}
      keyboardType="decimal-pad"
      selectTextOnFocus
      style={compact ? { textAlign: 'right' } : { fontSize: 20, fontWeight: '700' }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#F8FAFC',
  },
  section: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  kdvTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.successBg,
    borderRadius: 12,
    padding: 12,
  },
  kdvTotalLabel: { color: colors.success, fontWeight: '600' },
  kdvTotalValue: { color: colors.success, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
