import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconTile } from '../components/ui/IconTile';
import { ListRow, ListSection } from '../components/ui/List';
import { confirmDestructive, showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { categoryNameError, customCategories, isBuiltinCategory, useCategories } from '../lib/categories';
import { showCategoryPicker } from '../lib/categoryPicker';
import { errorMessage } from '../lib/errors';
import { haptics } from '../lib/haptics';
import { categoryMeta, fontFamily, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { addCustomCategory, deleteCustomCategory, getCategoryCounts, renameCustomCategory } from '../services/supabase/categoriesRepository';
import type { Kategori } from '../types/receipt';

/** Kategoriler: kendi kategorilerini ekle, yeniden adlandır, sil; hazır kategorileri ve fiş sayılarını gör. */
export default function CategoriesScreen() {
  const theme = useTheme();
  const categories = useCategories();
  const custom = categories.filter((k) => !isBuiltinCategory(k));
  const builtins = categories.filter((k) => isBuiltinCategory(k));
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCounts = useCallback(() => {
    getCategoryCounts()
      .then(setCounts)
      .catch(() => setCounts(null));
  }, []);
  useFocusEffect(loadCounts);

  const countOf = (k: Kategori) => (counts ? String(counts.get(k) ?? 0) : '—');

  async function run(task: () => Promise<string>) {
    setBusy(true);
    try {
      const message = await task();
      haptics.success();
      showToast(message);
      loadCounts();
    } catch (e) {
      haptics.error();
      showAlert('İşlem tamamlanamadı', errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function add() {
    const problem = categoryNameError(newName);
    if (problem) {
      haptics.error();
      showAlert('Eklenemedi', problem);
      return;
    }
    run(async () => {
      const k = await addCustomCategory(newName);
      setNewName('');
      return `"${categoryMeta(k).label}" eklendi`;
    });
  }

  function saveRename() {
    if (!renaming) return;
    const problem = categoryNameError(renaming.to, undefined, renaming.from);
    if (problem) {
      haptics.error();
      showAlert('Değiştirilemedi', problem);
      return;
    }
    const { from, to } = renaming;
    run(async () => {
      const moved = await renameCustomCategory(from, to);
      setRenaming(null);
      return moved ? `Kategori adı değişti · ${moved} fiş güncellendi` : 'Kategori adı değişti';
    });
  }

  function remove(k: Kategori, moveTo: Kategori) {
    const n = counts?.get(k) ?? 0;
    const target = categoryMeta(moveTo).label;
    confirmDestructive(
      `"${categoryMeta(k).label}" silinsin mi?`,
      n ? `Bu kategorideki ${n} fiş ${target} kategorisine taşınacak.` : 'Bu kategoride fiş yok.',
      'Kategoriyi Sil',
      () =>
        run(async () => {
          const moved = await deleteCustomCategory(k, moveTo);
          return moved ? `Kategori silindi · ${moved} fiş ${target} oldu` : 'Kategori silindi';
        }),
    );
  }

  function openCustom(k: Kategori) {
    const n = counts?.get(k) ?? 0;
    showActionSheet({
      title: categoryMeta(k).label,
      options: [
        {
          label: 'Yeniden Adlandır',
          onPress: () => setRenaming({ from: k, to: k }),
        },
        ...(n
          ? [
              {
                label: 'Sil ve Fişleri Başka Kategoriye Taşı',
                destructive: true,
                onPress: () =>
                  showCategoryPicker({
                    title: `${n} fiş nereye taşınsın?`,
                    onSelect: (to) => {
                      if (to === k) return;
                      // Seçicide yeni eklenen kategori de olabilir: listede hâlâ duruyorsa taşı
                      if (!isBuiltinCategory(to) && !customCategories().includes(to)) return;
                      remove(k, to);
                    },
                  }),
              },
            ]
          : []),
        {
          label: n ? 'Sil (Fişler Diğer’e Taşınır)' : 'Sil',
          destructive: true,
          onPress: () => remove(k, 'diğer'),
        },
      ],
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        <ListSection
          header="Kendi Kategorileriniz"
          footer="Eklediğiniz kategoriler fiş formunda ve yapay zekânın seçeneklerinde de görünür. Bir kategoriyi silerseniz içindeki fişler seçtiğiniz kategoriye taşınır.">
          {custom.map((k) => {
            const meta = categoryMeta(k);
            if (renaming?.from === k) {
              return (
                <InputRow
                  key={k}
                  icon={{
                    sf: meta.sf,
                    ion: meta.ion,
                    color: theme[meta.color] as string,
                  }}>
                  <TextInput
                    value={renaming.to}
                    onChangeText={(to) => setRenaming({ from: k, to })}
                    autoFocus
                    maxLength={40}
                    returnKeyType="done"
                    onSubmitEditing={saveRename}
                    style={[t.body, styles.input, { color: theme.label }]}
                  />
                  <TextButton title="Vazgeç" onPress={() => setRenaming(null)} />
                  <TextButton title="Kaydet" bold onPress={saveRename} disabled={busy} />
                </InputRow>
              );
            }
            return (
              <ListRow
                key={k}
                title={meta.label}
                icon={{
                  sf: meta.sf,
                  ion: meta.ion,
                  color: theme[meta.color] as string,
                }}
                value={countOf(k)}
                chevron
                onPress={() => openCustom(k)}
                disabled={busy}
              />
            );
          })}
          <InputRow icon={{ sf: 'plus', ion: 'add', color: theme.green }}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Yeni kategori adı"
              placeholderTextColor={theme.tertiaryLabel}
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={add}
              style={[t.body, styles.input, { color: theme.label }]}
            />
            {busy ? <ActivityIndicator /> : <TextButton title="Ekle" bold onPress={add} disabled={!newName.trim()} />}
          </InputRow>
        </ListSection>

        <ListSection header="Hazır Kategoriler" footer="Sağdaki sayı, o kategorideki fiş sayısıdır.">
          {builtins.map((k) => {
            const meta = categoryMeta(k);
            return (
              <ListRow
                key={k}
                title={meta.label}
                icon={{
                  sf: meta.sf,
                  ion: meta.ion,
                  color: theme[meta.color] as string,
                }}
                value={countOf(k)}
              />
            );
          })}
        </ListSection>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Liste satırı görünümünde düzenleme satırı: solda simge, sağda metin kutusu ve düğmeler */
function InputRow({ icon, children, isLast }: { icon: { sf: string; ion: string; color: string }; children: ReactNode; isLast?: boolean }) {
  const theme = useTheme();
  return (
    <View>
      <View style={styles.row}>
        <IconTile {...icon} />
        {children}
      </View>
      {!isLast && <View style={[styles.separator, { backgroundColor: theme.separator }]} />}
    </View>
  );
}

function TextButton({ title, onPress, bold, disabled }: { title: string; onPress: () => void; bold?: boolean; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button">
      <Text
        style={[
          t.body,
          {
            color: disabled ? theme.tertiaryLabel : theme.blue,
            fontWeight: bold ? '600' : '400',
          },
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 + 29 + 12 },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontFamily,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
});
