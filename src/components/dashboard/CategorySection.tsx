import { StyleSheet, View } from 'react-native';

import { formatTL } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { categoryMeta, useTheme } from '../../lib/theme';
import type { Kategori } from '../../types/receipt';
import { Icon } from '../ui/Icon';
import { ListRow, ListSection } from '../ui/List';

interface Props {
  items: { kategori: Kategori; toplam: number }[];
  selected: Kategori | null;
  onSelect: (k: Kategori | null) => void;
}

/** Kategori payları şeridi ve dokununca listeyi o kategoriye süzen satırlar. */
export function CategorySection({ items, selected, onSelect }: Props) {
  const theme = useTheme();
  const total = items.reduce((a, k) => a + k.toplam, 0);
  return (
    <ListSection header="Kategoriler">
      <View style={styles.barWrap}>
        <View style={[styles.bar, { backgroundColor: theme.tertiaryFill }]}>
          {items.map((k) => (
            <View key={k.kategori} style={{ flex: k.toplam, backgroundColor: theme[categoryMeta[k.kategori].color] as string }} />
          ))}
        </View>
      </View>
      {items.map((k) => {
        const meta = categoryMeta[k.kategori];
        return (
          <ListRow
            key={k.kategori}
            icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
            title={meta.label}
            value={`${formatTL(k.toplam)}  ·  %${total ? Math.round((k.toplam / total) * 100) : 0}`}
            onPress={() => {
              haptics.select();
              onSelect(selected === k.kategori ? null : k.kategori);
            }}
            accessory={
              <View style={{ width: 18, alignItems: 'flex-end' }}>
                {selected === k.kategori && <Icon sf="checkmark" ion="checkmark" size={16} color={theme.blue} weight="semibold" />}
              </View>
            }
          />
        );
      })}
    </ListSection>
  );
}

const styles = StyleSheet.create({
  barWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
  bar: { height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', gap: 2 },
});
