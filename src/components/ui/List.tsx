import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useWide } from '../../lib/layout';
import { fontFamily, tabular, type as t, useShadcnTheme, useTheme } from '../../lib/theme';
import { Icon } from './Icon';
import { IconTile } from './IconTile';

interface SectionProps {
  header?: string;
  /** Başlığın sağında mavi metin düğmesi (ör. "Sırala") */
  headerAction?: { label: string; onPress: () => void; accessibilityLabel?: string };
  footer?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

/** iOS "inset grouped" liste bölümü / Shadcn Kart bölümü */
export function ListSection({ header, headerAction, footer, children, style }: SectionProps) {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<{ isLast?: boolean }>[];
  return (
    <View style={[styles.section, wide && styles.sectionWide, style]}>
      {header && (
        <View style={styles.headerRow}>
          <Text style={[t.footnote, styles.header, wide && styles.headerWide, { color: wide ? st.mutedForeground : theme.secondaryLabel }]}>
            {header.toLocaleUpperCase('tr-TR')}
          </Text>
          {headerAction && (
            <Pressable onPress={headerAction.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={headerAction.accessibilityLabel ?? headerAction.label}>
              {({ pressed }) => (
                <Text style={[t.footnote, styles.headerAction, { color: wide ? st.cardForeground : theme.blue, fontWeight: wide ? '600' : '400', opacity: pressed ? 0.5 : 1 }]}>
                  {headerAction.label}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      )}
      {rows.length > 0 && (
        <View style={[styles.card, wide && [styles.cardWide, { borderColor: st.border, borderWidth: 1 }], { backgroundColor: wide ? st.card : theme.card }]}>
          {rows.map((row, i) => cloneElement(row, { key: row.key ?? i, isLast: i === rows.length - 1 }))}
        </View>
      )}
      {typeof footer === 'string' ? (
        <Text style={[t.footnote, styles.footer, { color: wide ? st.mutedForeground : theme.secondaryLabel }]}>{footer}</Text>
      ) : (
        footer
      )}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  /** Sağdaki değerin rengi (varsayılan: ikincil) */
  valueColor?: string;
  icon?: { sf: string; ion: string; color: string };
  chevron?: boolean;
  /** Mavi (eylem) ya da kırmızı (yıkıcı) başlık */
  tone?: 'default' | 'action' | 'destructive';
  onPress?: () => void;
  onLongPress?: () => void;
  /** Sağ tarafta özel içerik (ör. TextInput) */
  accessory?: ReactNode;
  /** Satırın altındaki tam genişlik içerik (ör. grafik) */
  children?: ReactNode;
  isLast?: boolean;
  disabled?: boolean;
}

export function ListRow({
  title,
  subtitle,
  value,
  valueColor,
  icon,
  chevron,
  tone = 'default',
  onPress,
  onLongPress,
  accessory,
  children,
  isLast,
  disabled,
}: ListRowProps) {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();
  const titleColor = tone === 'action' ? (wide ? st.cardForeground : theme.blue) : tone === 'destructive' ? theme.red : (wide ? st.cardForeground : theme.label);
  const inset = icon ? 16 + 29 + 12 : 16;
  const interactive = !!(onPress || onLongPress);

  const content = (
    <>
      <View style={[styles.row, { minHeight: subtitle ? 58 : 44 }]}>
        {icon && <IconTile {...icon} />}
        <View style={{ flex: 1, paddingVertical: 10 }}>
          <Text style={[t.body, wide && styles.titleWide, { color: disabled ? (wide ? st.mutedForeground : theme.tertiaryLabel) : titleColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[t.subhead, wide && styles.subtitleWide, { color: wide ? st.mutedForeground : theme.secondaryLabel, marginTop: 1 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {value !== undefined && (
          <Text style={[t.body, tabular, wide && styles.valueWide, { color: valueColor ?? (wide ? st.mutedForeground : theme.secondaryLabel) }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {accessory}
        {chevron && <Icon sf="chevron.right" ion="chevron-forward" size={13} color={wide ? st.mutedForeground : theme.tertiaryLabel} weight="semibold" />}
      </View>
      {children}
      {!isLast && <View style={[styles.separator, { marginLeft: wide ? 16 : inset, backgroundColor: wide ? st.border : theme.separator }]} />}
    </>
  );

  // Dokunulamayan satır düz View
  if (!interactive) return <View>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        { backgroundColor: pressed ? (wide ? st.muted : theme.highlight) : (hovered && wide ? st.muted : 'transparent') },
      ]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginBottom: 28 },
  sectionWide: { marginHorizontal: 16, marginBottom: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  header: { marginLeft: 16, marginBottom: 7, flexShrink: 1 },
  headerWide: { marginLeft: 4, marginBottom: 8, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  headerAction: { marginRight: 16, marginBottom: 7 },
  footer: { marginHorizontal: 16, marginTop: 7 },
  card: { borderRadius: 12, overflow: 'hidden' },
  cardWide: { borderRadius: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  titleWide: { fontFamily, fontSize: 14, fontWeight: '500' },
  subtitleWide: { fontFamily, fontSize: 12 },
  valueWide: { fontFamily, fontSize: 13 },
  separator: { height: StyleSheet.hairlineWidth },
});

interface FieldRowProps {
  label: string;
  isLast?: boolean;
  /** Değer kontrol edilmeli (ör. yapay zekâ emin değil): etiket turuncu ve soru işaretli */
  highlight?: boolean;
  children: ReactNode;
}

/** Form satırı: solda etiket, sağda düzenlenebilir değer (Kişiler > Düzenle gibi). */
export function FieldRow({ label, isLast, highlight, children }: FieldRowProps) {
  const theme = useTheme();
  return (
    <View
      style={highlight ? { backgroundColor: theme.dark ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.10)' } : undefined}
      accessibilityHint={highlight ? 'Net okunamadı, fişle karşılaştırın' : undefined}>
      <View style={[styles.row, { minHeight: 44 }]}>
        <View style={{ width: 96, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[t.body, { color: highlight ? theme.orange : theme.label }]}>{label}</Text>
          {highlight && <Icon sf="questionmark.circle.fill" ion="help-circle" size={15} color={theme.orange} />}
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>{children}</View>
      </View>
      {!isLast && <View style={[styles.separator, { marginLeft: 16, backgroundColor: theme.separator }]} />}
    </View>
  );
}
