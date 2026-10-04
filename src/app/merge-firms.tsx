import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ListRow, ListSection } from '../components/ui/List';
import { useSingleFlight } from '../hooks/useSingleFlight';
import { showActionSheet } from '../lib/actionSheet';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { findFirmGroups, type FirmGroup } from '../lib/firmMerge';
import { haptics } from '../lib/haptics';
import { showToast } from '../lib/toast';
import { useTheme } from '../lib/theme';
import { getFirmNameCounts, renameFirms } from '../services/supabase/receiptsRepository';

/** Grup başına kullanıcı seçimi: hangi ad kullanılacak, hangi yazımlar dahil */
interface Choice {
  target: string;
  excluded: Set<string>;
}

/** Aynı firmanın farklı yazımlarını tek ada birleştirme (Ayarlar → Veriler). */
export default function MergeFirmsScreen() {
  const theme = useTheme();
  const runOnce = useSingleFlight();
  const [groups, setGroups] = useState<FirmGroup[] | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  const load = useCallback(async () => {
    try {
      const g = findFirmGroups(await getFirmNameCounts());
      setGroups(g);
      setChoices(Object.fromEntries(g.map((x) => [x.suggested, { target: x.suggested, excluded: new Set<string>() }])));
    } catch (e) {
      showAlert('Firmalar alınamadı', errorMessage(e));
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    // load asenkron: durum yalnızca yanıt geldikten sonra güncellenir
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!groups) return <ActivityIndicator style={{ marginTop: 48 }} />;

  if (groups.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center' }}>
        <EmptyState
          icon={{ sf: 'checkmark.seal', ion: 'checkmark-done-circle-outline' }}
          title="Birleştirilecek Firma Yok"
          message="Aynı firmanın farklı yazılmış adları bulunamadı."
        />
      </View>
    );
  }

  function update(key: string, patch: Partial<Choice>) {
    setChoices((c) => ({ ...c, [key]: { ...c[key]!, ...patch } }));
  }

  function chooseTarget(g: FirmGroup) {
    showActionSheet({
      title: 'Kullanılacak ad',
      options: g.variants.map((v) => ({
        label: v.name,
        onPress: () => {
          haptics.select();
          const excluded = new Set(choices[g.suggested]!.excluded);
          excluded.delete(v.name);
          update(g.suggested, { target: v.name, excluded });
        },
      })),
    });
  }

  async function merge(g: FirmGroup) {
    const c = choices[g.suggested]!;
    const from = g.variants.filter((v) => v.name !== c.target && !c.excluded.has(v.name));
    if (!from.length) return;
    await runOnce(async () => {
      try {
        const changed = await renameFirms(
          from.map((v) => v.name),
          c.target,
        );
        haptics.success();
        showToast(`${changed} fiş “${c.target}” adına taşındı`);
        await load();
      } catch (e) {
        showAlert('Birleştirilemedi', errorMessage(e));
      }
    });
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      <ListSection footer="Aynı firmanın farklı yazımları tek adda toplanırsa raporlar ve “en çok harcama” daha doğru çıkar. Dahil etmek istemediğiniz yazıma dokunarak işareti kaldırın.">
        <ListRow title={`${groups.length} firmada farklı yazım bulundu`} icon={{ sf: 'building.2.fill', ion: 'business', color: theme.blue }} />
      </ListSection>
      {groups.map((g) => {
        const c = choices[g.suggested];
        if (!c) return null;
        const moving = g.variants.filter((v) => v.name !== c.target && !c.excluded.has(v.name));
        const count = moving.reduce((a, v) => a + v.count, 0);
        return (
          <ListSection key={g.suggested} header={`${g.variants.length} yazım · ${g.total} fiş`}>
            <ListRow title="Kullanılacak ad" value={c.target} onPress={() => chooseTarget(g)} chevron />
            {g.variants
              .filter((v) => v.name !== c.target)
              .map((v) => {
                const on = !c.excluded.has(v.name);
                return (
                  <ListRow
                    key={v.name}
                    title={v.name}
                    subtitle={`${v.count} fiş`}
                    onPress={() => {
                      haptics.select();
                      const excluded = new Set(c.excluded);
                      if (on) excluded.add(v.name);
                      else excluded.delete(v.name);
                      update(g.suggested, { excluded });
                    }}
                    accessory={
                      <View style={{ width: 22, alignItems: 'flex-end' }} accessibilityLabel={on ? 'dahil' : 'dahil değil'}>
                        <Icon
                          sf={on ? 'checkmark.circle.fill' : 'circle'}
                          ion={on ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={on ? theme.blue : theme.tertiaryLabel}
                        />
                      </View>
                    }
                  />
                );
              })}
            <ListRow title={count ? `Birleştir (${count} fiş)` : 'Birleştirilecek yazım seçilmedi'} tone="action" disabled={!count} onPress={() => merge(g)} />
          </ListSection>
        );
      })}
    </ScrollView>
  );
}
