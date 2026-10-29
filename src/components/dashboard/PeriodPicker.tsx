import NativeSegmentedControl, {
  type SegmentedControlProps,
} from '@react-native-segmented-control/segmented-control';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { capitalizeTr } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import { useWide } from '../../lib/layout';
import type { Period } from '../../lib/period';
import { fontFamily, type Theme, type as t, useShadcnTheme, useTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { TabsList, TabsTrigger } from '../web/Tabs';

// RN 0.88 tipleri artık `NativeMethods` dışa aktarmıyor; paketin sınıf tipi bu
// yüzden JSX'te kullanılamıyor. Çalışma zamanı aynı, yalnızca tipi düzeltiyoruz.
const SegmentedControl = NativeSegmentedControl as unknown as ComponentType<SegmentedControlProps>;

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
  const st = useShadcnTheme();
  const wide = useWide();
  const isMonth = period.mode === 'month';
  const modes = ['month', 'year', 'all'] as const;

  if (wide) {
    return (
      <View style={styles.controlsWide}>
        {/* Shadcn Tabs list */}
        <TabsList>
          <TabsTrigger value="month" active={period.mode === 'month'} onPress={() => onMode('month')}>
            Aylık
          </TabsTrigger>
          <TabsTrigger value="year" active={period.mode === 'year'} onPress={() => onMode('year')}>
            Yıllık
          </TabsTrigger>
          <TabsTrigger value="all" active={period.mode === 'all'} onPress={() => onMode('all')}>
            Tüm Zamanlar
          </TabsTrigger>
        </TabsList>

        {period.mode !== 'all' && (
          <View style={[styles.monthRowWide, { borderColor: st.border, backgroundColor: st.card }]}>
            <Pressable
              onPress={() => {
                haptics.select();
                onPrev();
              }}
              accessibilityRole="button"
              accessibilityLabel={isMonth ? 'Önceki ay' : 'Önceki yıl'}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.navBtnWide,
                (hovered || pressed) && { backgroundColor: st.muted },
              ]}>
              <Icon sf="chevron.left" ion="chevron-back" size={16} color={st.cardForeground} weight="semibold" />
            </Pressable>
            <Text style={[styles.periodTextWide, { color: st.cardForeground }]}>{capitalizeTr(label)}</Text>
            <Pressable
              onPress={() => {
                haptics.select();
                onNext();
              }}
              disabled={period.offset === 0}
              accessibilityRole="button"
              accessibilityLabel={isMonth ? 'Sonraki ay' : 'Sonraki yıl'}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.navBtnWide,
                period.offset === 0 && { opacity: 0.3 },
                period.offset !== 0 && (hovered || pressed) && { backgroundColor: st.muted },
              ]}>
              <Icon sf="chevron.right" ion="chevron-forward" size={16} color={st.cardForeground} weight="semibold" />
            </Pressable>
          </View>
        )}
      </View>
    );
  }

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

  // Shadcn Wide styles
  controlsWide: {
    marginHorizontal: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthRowWide: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navBtnWide: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTextWide: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
});
