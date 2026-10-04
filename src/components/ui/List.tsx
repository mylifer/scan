import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { tabular, type as t, useTheme } from '../../lib/theme';
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

/** iOS "inset grouped" liste bölümü: başlık, yuvarlatılmış kart, dipnot. */
export function ListSection({ header, headerAction, footer, children, style }: SectionProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement) as ReactElement<{ isLast?: boolean }>[];
  return (
    <View style={[styles.section, style]}>
      {header && (
        <View style={styles.headerRow}>
          <Text style={[t.footnote, styles.header, { color: theme.secondaryLabel }]}>{header.toLocaleUpperCase('tr-TR')}</Text>
          {headerAction && (
            <Pressable onPress={headerAction.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={headerAction.accessibilityLabel ?? headerAction.label}>
              {({ pressed }) => <Text style={[t.footnote, styles.headerAction, { color: theme.blue, opacity: pressed ? 0.5 : 1 }]}>{headerAction.label}</Text>}
            </Pressable>
          )}
        </View>
      )}
      {rows.length > 0 && (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {rows.map((row, i) => cloneElement(row, { key: row.key ?? i, isLast: i === rows.length - 1 }))}
        </View>
      )}
      {typeof footer === 'string' ? (
        <Text style={[t.footnote, styles.footer, { color: theme.secondaryLabel }]}>{footer}</Text>
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
  const titleColor = tone === 'action' ? theme.blue : tone === 'destructive' ? theme.red : theme.label;
  const inset = icon ? 16 + 29 + 12 : 16;
  const interactive = !!(onPress || onLongPress);

  const content = (
    <>
      <View style={[styles.row, { minHeight: subtitle ? 60 : 44 }]}>
        {icon && <IconTile {...icon} />}
        <View style={{ flex: 1, paddingVertical: 11 }}>
          <Text style={[t.body, { color: disabled ? theme.tertiaryLabel : titleColor }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[t.subhead, { color: theme.secondaryLabel, marginTop: 1 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {value !== undefined && (
          <Text style={[t.body, tabular, { color: valueColor ?? theme.secondaryLabel }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {accessory}
        {chevron && <Icon sf="chevron.right" ion="chevron-forward" size={14} color={theme.tertiaryLabel} weight="semibold" />}
      </View>
      {children}
      {!isLast && <View style={[styles.separator, { marginLeft: inset, backgroundColor: theme.separator }]} />}
    </>
  );

  // Dokunulamayan satır düz View: devre dışı bir Pressable web'de aria-disabled taşır ve içerideki
  // anahtarı (Switch) da erişilebilirlik ağacında devre dışı gösterir. Diğer denetimlere VoiceOver
  // ile ayrıca ulaşılabilsin diye satır tek öğe olarak okunmaz.
  if (!interactive) return <View>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [{ backgroundColor: pressed ? theme.highlight : 'transparent' }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginBottom: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  header: { marginLeft: 16, marginBottom: 7, flexShrink: 1 },
  headerAction: { marginRight: 16, marginBottom: 7 },
  footer: { marginHorizontal: 16, marginTop: 7 },
  card: { borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
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
