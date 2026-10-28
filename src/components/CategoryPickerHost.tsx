import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryNameError, cleanCategoryName, findCategory, useCategories } from '../lib/categories';
import { type CategoryPickRequest, subscribeCategoryPicker } from '../lib/categoryPicker';
import { errorMessage } from '../lib/errors';
import { haptics } from '../lib/haptics';
import { normalizeForSearch } from '../lib/search';
import { categoryMeta, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { addCustomCategory } from '../services/supabase/categoriesRepository';
import type { Kategori } from '../types/receipt';
import { Icon } from './ui/Icon';
import { ListRow, ListSection } from './ui/List';
import { SearchField } from './ui/SearchField';

/** Kategori seçme sayfası: arama, seçili işareti, yazılan ad yoksa tek dokunuşla yeni kategori. */
export function CategoryPickerHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const categories = useCategories();
  const [req, setReq] = useState<CategoryPickRequest | null>(null);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(
    () =>
      subscribeCategoryPicker((r) => {
        setQuery('');
        setReq(r);
      }),
    [],
  );

  const shown = useMemo(() => {
    const q = normalizeForSearch(query);
    if (!q) return categories;
    return categories.filter((k) => normalizeForSearch(categoryMeta(k).label).includes(q) || normalizeForSearch(k).includes(q));
  }, [categories, query]);

  const typed = cleanCategoryName(query);
  const canAdd = !!typed && !findCategory(typed, categories);

  const close = () => setReq(null);
  const choose = (k: Kategori) => {
    haptics.select();
    const r = req;
    close();
    r?.onSelect(k);
  };

  async function add() {
    const problem = categoryNameError(typed, categories);
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setAdding(true);
    try {
      const k = await addCustomCategory(typed);
      haptics.success();
      showToast(`"${categoryMeta(k).label}" kategorisi eklendi`);
      choose(k);
    } catch (e) {
      haptics.error();
      showToast(errorMessage(e), 'error', 4000);
    } finally {
      setAdding(false);
    }
  }

  return (
    <Modal
      visible={!!req}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined}
      transparent={Platform.OS !== 'ios'}
      onRequestClose={close}>
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.background,
            paddingTop: Platform.OS === 'ios' ? 0 : insets.top,
          },
        ]}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
            <Text style={[t.body, { color: theme.blue }]}>Vazgeç</Text>
          </Pressable>
          <Text style={[t.headline, { color: theme.label }]} numberOfLines={1}>
            {req?.title ?? 'Kategori'}
          </Text>
          <View style={{ width: 56 }} />
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <SearchField value={query} onChangeText={setQuery} placeholder="Ara ya da yeni kategori yaz" />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {canAdd && (
            <ListSection>
              <ListRow
                title={`“${typed}” Kategorisini Ekle`}
                tone="action"
                icon={{ sf: 'plus', ion: 'add', color: theme.blue }}
                onPress={add}
                disabled={adding}
                accessory={adding ? <ActivityIndicator /> : undefined}
              />
            </ListSection>
          )}
          {shown.length > 0 && (
            <ListSection>
              {shown.map((k) => {
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
                    accessory={k === req?.selected ? <Icon sf="checkmark" ion="checkmark" size={17} color={theme.blue} weight="semibold" /> : undefined}
                    onPress={() => choose(k)}
                  />
                );
              })}
            </ListSection>
          )}
          <ListSection footer="Kendi kategorilerinizi yeniden adlandırabilir ya da silebilirsiniz.">
            <ListRow
              title="Kategorileri Düzenle"
              tone="action"
              icon={{
                sf: 'slider.horizontal.3',
                ion: 'options',
                color: theme.gray,
              }}
              onPress={() => {
                close();
                router.push('/categories');
              }}
            />
          </ListSection>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, width: '100%', maxWidth: 700, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
});
