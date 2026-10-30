import DateTimePicker from '@react-native-community/datetimepicker';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { showCategoryPicker } from '../lib/categoryPicker';
import { formatTL, normalizeTrDate, parseAmount, round2, todayTr } from '../lib/format';
import { formWarnings, type ReceiptFormValues, setFormField } from '../lib/receiptForm';
import { haptics } from '../lib/haptics';
import { useWide } from '../lib/layout';
import { categoryMeta, fontFamily, tabular, type as t, useShadcnTheme, useTheme } from '../lib/theme';
import { MAX_NOTE_LENGTH, parseTags } from '../lib/receiptExtras';
import { normalizeForSearch } from '../lib/search';
import { getKnownTags } from '../services/supabase/receiptsRepository';
import type { ReceiptField } from '../types/receipt';
import { Icon } from './ui/Icon';
import { FieldRow, ListRow, ListSection } from './ui/List';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './web/Card';
import { WebInput } from './web/Input';

export { emptyForm, formWarnings, fromFormValues, type ReceiptFormValues, toFormValues, validateForm } from '../lib/receiptForm';

interface Props {
  values: ReceiptFormValues;
  onChange: (values: ReceiptFormValues) => void;
}

export function ReceiptForm({ values, onChange }: Props) {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
  const set = <K extends keyof ReceiptFormValues>(key: K, value: ReceiptFormValues[K]) => onChange(setFormField(values, key, value));
  const unsure = (f: ReceiptField) => values.belirsiz?.includes(f) ?? false;
  const toplamKdv = round2(parseAmount(values.kdvYuzde1) + parseAmount(values.kdvYuzde10) + parseAmount(values.kdvYuzde20));
  const kdvTooHigh = toplamKdv > parseAmount(values.toplamTutar) && parseAmount(values.toplamTutar) > 0;
  const meta = categoryMeta(values.kategori);

  function pickCategory() {
    showCategoryPicker({ selected: values.kategori, onSelect: (k) => set('kategori', k) });
  }

  // Daha önce kullanılan etiketler (öneri olarak; alınamazsa öneri gösterilmez)
  const [knownTags, setKnownTags] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    getKnownTags()
      .then((tags) => {
        if (alive) setKnownTags(tags);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const currentTags = parseTags(values.etiketler);
  const suggestions = knownTags.filter((tag) => !currentTags.some((c) => normalizeForSearch(c) === normalizeForSearch(tag))).slice(0, 12);
  function addTag(tag: string) {
    haptics.select();
    set('etiketler', [...currentTags, tag].join(', '));
  }

  const warnings = formWarnings(values);

  if (wide) {
    return (
      <View style={{ gap: 20 }}>
        {!!values.belirsiz?.length && (
          <View style={[styles.webWarning, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
            <Icon sf="questionmark.circle.fill" ion="help-circle" size={18} color="#b45309" />
            <Text style={[styles.webWarningText, { color: '#92400e' }]}>
              Turuncu işaretli {values.belirsiz.length === 1 ? 'alan' : `${values.belirsiz.length} alan`} fişte net okunamadı. Fişle karşılaştırıp gerekirse düzeltin.
            </Text>
          </View>
        )}
        {warnings.length > 0 && (
          <View style={[styles.webWarning, { backgroundColor: '#fef2f2', borderColor: '#ef4444' }]}>
            <Icon sf="exclamationmark.triangle.fill" ion="warning" size={18} color="#b91c1c" />
            <View style={{ flex: 1, gap: 4 }}>
              {warnings.map((w) => (
                <Text key={w} style={[styles.webWarningText, { color: '#991b1b' }]}>
                  {w}
                </Text>
              ))}
            </View>
          </View>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Fiş Bilgileri</CardTitle>
            <CardDescription>Firma adı, fiş tarihi ve harcama kategorisi.</CardDescription>
          </CardHeader>
          <CardContent style={{ gap: 16 }}>
            <View style={styles.webFieldGroup}>
              <Text style={[styles.webLabel, { color: unsure('firmaAdi') ? '#d97706' : st.cardForeground }]}>
                Firma Adı {unsure('firmaAdi') ? '• Okunamadı' : ''}
              </Text>
              <WebInput
                value={values.firmaAdi}
                onChangeText={(v) => set('firmaAdi', v)}
                placeholder="Firma adı"
                autoCapitalize="characters"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={[styles.webFieldGroup, { flex: 1 }]}>
                <Text style={[styles.webLabel, { color: unsure('tarih') ? '#d97706' : st.cardForeground }]}>
                  Tarih {unsure('tarih') ? '• Okunamadı' : ''}
                </Text>
                <WebInput
                  value={values.tarih}
                  onChangeText={(v) => set('tarih', v)}
                  placeholder="GG.AA.YYYY"
                />
              </View>
              <View style={[styles.webFieldGroup, { flex: 1 }]}>
                <Text style={[styles.webLabel, { color: unsure('kategori') ? '#d97706' : st.cardForeground }]}>
                  Kategori {unsure('kategori') ? '• Belirsiz' : ''}
                </Text>
                <Pressable
                  onPress={pickCategory}
                  style={[
                    styles.webCategoryPicker,
                    { borderColor: st.border, backgroundColor: st.card },
                  ]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <Icon sf={meta.sf} ion={meta.ion} size={18} color={theme[meta.color] as string} />
                    <Text style={{ fontFamily, fontSize: 13, fontWeight: '500', color: st.cardForeground }}>
                      {meta.label}
                    </Text>
                  </View>
                  <Icon sf="chevron.up.chevron.down" ion="swap-vertical" size={14} color={st.mutedForeground} />
                </Pressable>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tutar ve KDV Dağılımı</CardTitle>
            <CardDescription>Toplam fiş bedeli ve uygulanan vergi oranları.</CardDescription>
          </CardHeader>
          <CardContent style={{ gap: 16 }}>
            <View style={styles.webFieldGroup}>
              <Text style={[styles.webLabel, { color: unsure('toplamTutar') ? '#d97706' : st.cardForeground }]}>
                Toplam Tutar (₺) {unsure('toplamTutar') ? '• Okunamadı' : ''}
              </Text>
              <WebInput
                value={values.toplamTutar}
                onChangeText={(v) => set('toplamTutar', v)}
                placeholder="0,00"
                keyboardType="decimal-pad"
                style={[{ fontSize: 18, fontWeight: '700' }, tabular]}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={[styles.webLabel, { color: st.cardForeground }]}>KDV Oranları (₺)</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.webSubLabel, { color: unsure('kdvYuzde1') ? '#d97706' : st.mutedForeground }]}>
                    %1 KDV
                  </Text>
                  <WebInput
                    value={values.kdvYuzde1}
                    onChangeText={(v) => set('kdvYuzde1', v)}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    style={tabular}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.webSubLabel, { color: unsure('kdvYuzde10') ? '#d97706' : st.mutedForeground }]}>
                    %10 KDV
                  </Text>
                  <WebInput
                    value={values.kdvYuzde10}
                    onChangeText={(v) => set('kdvYuzde10', v)}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    style={tabular}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.webSubLabel, { color: unsure('kdvYuzde20') ? '#d97706' : st.mutedForeground }]}>
                    %20 KDV
                  </Text>
                  <WebInput
                    value={values.kdvYuzde20}
                    onChangeText={(v) => set('kdvYuzde20', v)}
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    style={tabular}
                  />
                </View>
              </View>
            </View>

            <View style={[styles.webKdvSummary, { backgroundColor: kdvTooHigh ? '#fef2f2' : st.muted }]}>
              <Text style={[styles.webKdvSummaryText, { color: kdvTooHigh ? '#dc2626' : st.mutedForeground }]}>
                {kdvTooHigh
                  ? '⚠ Toplam KDV, toplam tutardan büyük! TOPLAM ile TOPKDV karışmış olabilir.'
                  : `Hesaplanan Toplam KDV: ${formatTL(toplamKdv)}`}
              </Text>
            </View>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ek Bilgiler ve Notlar</CardTitle>
            <CardDescription>Fiş no, VKN/TCKN, arama etiketleri ve özel notlarınız.</CardDescription>
          </CardHeader>
          <CardContent style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={[styles.webFieldGroup, { flex: 1 }]}>
                <Text style={[styles.webLabel, { color: unsure('fisNo') ? '#d97706' : st.cardForeground }]}>
                  Fiş No {unsure('fisNo') ? '• Okunamadı' : ''}
                </Text>
                <WebInput
                  value={values.fisNo}
                  onChangeText={(v) => set('fisNo', v)}
                  placeholder="ör. 0045"
                  autoCapitalize="characters"
                  maxLength={40}
                />
              </View>
              <View style={[styles.webFieldGroup, { flex: 1 }]}>
                <Text style={[styles.webLabel, { color: unsure('vkn') ? '#d97706' : st.cardForeground }]}>
                  VKN / TCKN {unsure('vkn') ? '• Okunamadı' : ''}
                </Text>
                <WebInput
                  value={values.vkn}
                  onChangeText={(v) => set('vkn', v)}
                  placeholder="10 ya da 11 hane"
                  keyboardType="number-pad"
                  maxLength={14}
                  style={tabular}
                />
              </View>
            </View>

            <View style={styles.webFieldGroup}>
              <Text style={[styles.webLabel, { color: st.cardForeground }]}>Etiketler</Text>
              <WebInput
                value={values.etiketler}
                onChangeText={(v) => set('etiketler', v)}
                placeholder="ör. Proje X, müşteri yemeği (virgülle ayırın)"
                autoCapitalize="none"
              />
              {suggestions.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {suggestions.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => addTag(tag)}
                      style={({ pressed }: { pressed: boolean }) => [
                        styles.webChip,
                        {
                          backgroundColor: pressed ? st.secondary : st.muted,
                          borderColor: st.border,
                        },
                      ]}>
                      <Text style={[styles.webChipText, { color: st.foreground }]}>+ {tag}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.webFieldGroup}>
              <Text style={[styles.webLabel, { color: st.cardForeground }]}>Notlar</Text>
              <WebInput
                value={values.notlar}
                onChangeText={(v) => set('notlar', v)}
                placeholder="Bu fiş hakkında not ekleyin..."
                multiline
                numberOfLines={3}
                maxLength={MAX_NOTE_LENGTH}
                style={{ minHeight: 70, paddingTop: 8 }}
              />
            </View>
          </CardContent>
        </Card>
      </View>
    );
  }

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

      <ListSection
        header="Ek Bilgiler"
        footer="Fiş no ve VKN, aynı fişin iki kez kaydedilmesini daha güvenilir yakalar. Etiketleri virgülle ayırın; aramada da kullanılır.">
        <FieldRow label="Fiş No" highlight={unsure('fisNo')}>
          <Input
            value={values.fisNo}
            onChangeText={(v) => set('fisNo', v)}
            placeholder="ör. 0045"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="characters"
            maxLength={40}
          />
        </FieldRow>
        <FieldRow label="VKN/TCKN" highlight={unsure('vkn')}>
          <Input value={values.vkn} onChangeText={(v) => set('vkn', v)} placeholder="10 ya da 11 hane" keyboardType="number-pad" maxLength={14} style={tabular} />
        </FieldRow>
        <FieldRow label="Etiketler">
          <Input value={values.etiketler} onChangeText={(v) => set('etiketler', v)} placeholder="ör. X projesi, müşteri yemeği" autoCapitalize="none" />
        </FieldRow>
        {suggestions.length > 0 ? (
          <Plain>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.chips}>
              {suggestions.map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => addTag(tag)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tag} etiketini ekle`}
                  style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? theme.highlight : theme.tertiaryFill }]}>
                  <Text style={[t.subhead, { color: theme.blue }]}>+ {tag}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Plain>
        ) : null}
        <Plain>
          <View style={styles.noteRow}>
            <TextInput
              value={values.notlar}
              onChangeText={(v) => set('notlar', v)}
              placeholder="Not ekleyin"
              placeholderTextColor={theme.tertiaryLabel}
              multiline
              maxLength={MAX_NOTE_LENGTH}
              style={[t.body, styles.note, { color: theme.label }]}
            />
          </View>
        </Plain>
      </ListSection>
    </>
  );
}

/** ListSection satırlara isLast verir; düz içerikte bu özellik görünüme aktarılmasın */
function Plain({ children }: { children: ReactNode; isLast?: boolean }) {
  return <>{children}</>;
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
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  noteRow: { paddingHorizontal: 16, paddingVertical: 4 },
  note: { minHeight: 66, paddingVertical: 8, textAlignVertical: 'top', fontFamily, ...Platform.select({ web: { outlineWidth: 0 } }) },
  warning: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 20, padding: 12, borderRadius: 12 },
  webWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  webWarningText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  webFieldGroup: {
    gap: 6,
  },
  webLabel: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  webSubLabel: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
  },
  webCategoryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    cursor: 'pointer',
  },
  webKdvSummary: {
    padding: 10,
    borderRadius: 6,
  },
  webKdvSummaryText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '500',
  },
  webChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    cursor: 'pointer',
  },
  webChipText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
  },
});
