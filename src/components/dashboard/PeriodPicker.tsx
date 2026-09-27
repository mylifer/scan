import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { capitalizeTr } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { Period } from '../../lib/period';
import { type Theme, type as t, useTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface Props {
  period: Period;
  label: string;
  onMode: (mode: Period['mode']) => void;
  onPrev: () => void;
  onNext: () => void;
}

/** Aylık / Yıllık / Tüm Zamanlar seçici ve dönemler arası oklar. */
export function PeriodPicker({ period, label, onMode, onPrev, onNext }: Props) {
  const theme = useTheme();
  const isMonth = period.mode === 'month';
  const modes = ['month', 'year', 'all'] as const;
  return (
    <View style={styles.controls}>
      <SegmentedControl
        values={['Aylık', 'Yıllık', 'Tüm Zamanlar']}
        selectedIndex={modes.indexOf(period.mode)}
        onChange={(e) => {
          haptics.select();
          const mode = modes[e.nativeEvent.selectedSegmentIndex];
          if (mode) onMode(mode);
        }}
        appearance={theme.dark ? 'dark' : 'light'}
      />
      {period.mode !== 'all' && (
        <View style={styles.monthRow}>
          <ChevronButton dir="left" onPress={onPrev} theme={theme} label={isMonth ? 'Önceki ay' : 'Önceki yıl'} />
          <Text style={[t.headline, { color: theme.label }]}>{capitalizeTr(label)}</Text>
          <ChevronButton dir="right" onPress={onNext} disabled={period.offset === 0} theme={theme} label={isMonth ? 'Sonraki ay' : 'Sonraki yıl'} />
        </View>
      )}
    </View>
  );
}

function ChevronButton({ dir, onPress, disabled, theme, label }: { dir: 'left' | 'right'; onPress: () => void; disabled?: boolean; theme: Theme; label: string }) {
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={({ pressed }) => ({ opacity: disabled ? 0.25 : pressed ? 0.5 : 1, padding: 6 })}>
      <Icon sf={`chevron.${dir}`} ion={dir === 'left' ? 'chevron-back' : 'chevron-forward'} size={18} color={theme.blue} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { marginHorizontal: 16, marginBottom: 16, gap: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
