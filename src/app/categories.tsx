import { router, Stack, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '../components/ui/Icon';
import { IconTile } from '../components/ui/IconTile';
import { ListRow, ListSection } from '../components/ui/List';
import { Badge } from '../components/web/Badge';
import { WebButton } from '../components/web/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/web/Card';
import { WebInput } from '../components/web/Input';
import { WebPageHeader } from '../components/web/PageHeader';
import { confirmDestructive, showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { categoryNameError, customCategories, isBuiltinCategory, useCategories } from '../lib/categories';
import { showCategoryPicker } from '../lib/categoryPicker';
import { errorMessage } from '../lib/errors';
import { haptics } from '../lib/haptics';
import { useWide } from '../lib/layout';
import { categoryMeta, fontFamily, tabular, type as t, useShadcnTheme, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { addCustomCategory, deleteCustomCategory, getCategoryCounts, renameCustomCategory } from '../services/supabase/categoriesRepository';
import type { Kategori } from '../types/receipt';

/** Kategoriler: kendi kategorilerini ekle, yeniden adlandır, sil; hazır kategorileri ve fiş sayılarını gör. */
export default function CategoriesScreen() {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
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

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 840, width: '100%', gap: 24 }}>
            <WebPageHeader
              title="Kategoriler"
              description="Fişlerinizi sınıflandırmak, aramak ve vergi dönemlerinde filtrelemek için kategoriler."
              onBack={() => router.back()}
            />

            <Card>
              <CardHeader>
                <CardTitle>Yeni Kategori Ekle</CardTitle>
                <CardDescription>
                  Eklediğiniz kategoriler fiş formunda ve yapay zekâ taramalarında anında kullanılabilir.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <WebInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Kategori adı (ör. Ofis Malzemeleri, Yazılım Lisansları)"
                    maxLength={40}
                    onSubmitEditing={add}
                    containerStyle={{ flex: 1 }}
                  />
                  <WebButton
                    variant="default"
                    icon={{ sf: 'plus', ion: 'add' }}
                    onPress={add}
                    disabled={!newName.trim() || busy}
                    loading={busy}>
                    Ekle
                  </WebButton>
                </View>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Özel Kategorileriniz ({custom.length})</CardTitle>
                <CardDescription>
                  Tanımladığınız özel kategoriler. Bir kategoriyi sildiğinizde bağlı fişler dilediğiniz başka bir kategoriye aktarılır.
                </CardDescription>
              </CardHeader>
              <CardContent style={{ gap: 8 }}>
                {custom.length === 0 ? (
                  <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground, paddingVertical: 12 }}>
                    Henüz özel bir kategori tanımlamadınız. Yukarıdaki alandan ekleyebilirsiniz.
                  </Text>
                ) : (
                  custom.map((k) => {
                    const meta = categoryMeta(k);
                    const isRenaming = renaming?.from === k;

                    if (isRenaming) {
                      return (
                        <View
                          key={k}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: st.muted,
                          }}>
                          <WebInput
                            value={renaming.to}
                            onChangeText={(to) => setRenaming({ from: k, to })}
                            autoFocus
                            maxLength={40}
                            onSubmitEditing={saveRename}
                            containerStyle={{ flex: 1 }}
                          />
                          <WebButton variant="outline" size="sm" onPress={() => setRenaming(null)}>
                            Vazgeç
                          </WebButton>
                          <WebButton variant="default" size="sm" onPress={saveRename} loading={busy}>
                            Kaydet
                          </WebButton>
                        </View>
                      );
                    }

                    return (
                      <View
                        key={k}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: st.border,
                        }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Icon sf={meta.sf} ion={meta.ion} size={18} color={theme[meta.color] as string} />
                          <Text style={{ fontFamily, fontSize: 14, fontWeight: '600', color: st.cardForeground }}>
                            {meta.label}
                          </Text>
                          <Badge variant="secondary">
                            {countOf(k)} fiş
                          </Badge>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <WebButton
                            variant="ghost"
                            size="sm"
                            icon={{ sf: 'pencil', ion: 'pencil' }}
                            onPress={() => setRenaming({ from: k, to: meta.label })}>
                            Düzenle
                          </WebButton>
                          <WebButton
                            variant="ghost"
                            size="sm"
                            icon={{ sf: 'trash', ion: 'trash' }}
                            onPress={() => openCustom(k)}>
                            Sil
                          </WebButton>
                        </View>
                      </View>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hazır Kategoriler ({builtins.length})</CardTitle>
                <CardDescription>
                  Sistem tarafından ön tanımlı standart gider kategorileri ve toplam fiş adetleri.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {builtins.map((k) => {
                    const meta = categoryMeta(k);
                    return (
                      <View
                        key={k}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '48%',
                          minWidth: 260,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: st.border,
                        }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Icon sf={meta.sf} ion={meta.ion} size={18} color={theme[meta.color] as string} />
                          <Text style={{ fontFamily, fontSize: 13, fontWeight: '500', color: st.cardForeground }}>
                            {meta.label}
                          </Text>
                        </View>
                        <Badge variant="outline" style={tabular}>
                          {countOf(k)}
                        </Badge>
                      </View>
                    );
                  })}
                </View>
              </CardContent>
            </Card>
          </View>
        </ScrollView>
      </View>
    );
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
