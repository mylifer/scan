import { cloneElement, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { formatTL, shortTrDate } from '../../lib/format';
import { categoryMeta, useTheme } from '../../lib/theme';
import type { ReceiptRecord } from '../../types/receipt';
import { Icon } from '../ui/Icon';
import { ListRow } from '../ui/List';

interface RowProps {
  receipt: ReceiptRecord;
  onPress: () => void;
  isLast?: boolean;
  /** Seçim modunda: işaretli mi (undefined = seçim modu kapalı) */
  selected?: boolean;
}

export function ReceiptRow({ receipt: r, onPress, isLast, selected }: RowProps) {
  const theme = useTheme();
  const meta = categoryMeta[r.kategori] ?? categoryMeta['diğer'];
  const selecting = selected !== undefined;
  return (
    <ListRow
      icon={{ sf: meta.sf, ion: meta.ion, color: theme[meta.color] as string }}
      title={r.firma_adi}
      subtitle={`${shortTrDate(r.tarih)} · KDV ${formatTL(r.toplam_kdv)}`}
      value={formatTL(r.toplam_tutar)}
      valueColor={theme.label}
      chevron={!selecting}
      accessory={
        selecting ? (
          <View accessibilityLabel={selected ? 'seçili' : 'seçili değil'}>
            <Icon
              sf={selected ? 'checkmark.circle.fill' : 'circle'}
              ion={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={selected ? theme.blue : theme.tertiaryLabel}
            />
          </View>
        ) : undefined
      }
      onPress={onPress}
      isLast={isLast}
    />
  );
}

/** Sola kaydırınca kırmızı "Sil" düğmesi (iOS listeleri gibi) */
export function SwipeToDelete({ children, onDelete, isLast }: { children: ReactElement<{ isLast?: boolean }>; onDelete: () => void; isLast?: boolean }) {
  const theme = useTheme();
  return (
    <ReanimatedSwipeable
      friction={1.5}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onDelete} style={[styles.swipeDelete, { backgroundColor: theme.red }]} accessibilityLabel="Sil">
          <Icon sf="trash.fill" ion="trash" size={20} color="#fff" />
          <Text style={styles.swipeText}>Sil</Text>
        </Pressable>
      )}>
      <View style={{ backgroundColor: theme.card }}>{cloneElement(children, { isLast })}</View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  swipeDelete: { width: 84, alignItems: 'center', justifyContent: 'center', gap: 2 },
  swipeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
