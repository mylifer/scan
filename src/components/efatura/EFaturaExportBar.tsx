import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWide } from '../../lib/layout';
import { fontFamily, tabular, useShadcnTheme, useTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface Props {
  selectedCount: number;
  totalCount: number;
  totalAmount: number;
  currency: string;
  allSelected?: boolean;
  onToggleSelectAll?: () => void;
  onClearSelection: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  exportingText: string | null;
}

function para(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * e-Fatura listesinde tekli veya çoklu seçim yapıldığında
 * ekranın altında sabit yüzen modern dışa aktarma (Excel / PDF) çubuğu.
 */
export function EFaturaExportBar({
  selectedCount,
  totalCount,
  totalAmount,
  currency,
  onClearSelection,
  onExportExcel,
  onExportPdf,
  exportingText,
}: Props) {
  const t = useShadcnTheme();
  const theme = useTheme();
  const wide = useWide();
  const insets = useSafeAreaInsets();

  if (selectedCount === 0) return null;

  const isZip = selectedCount > 1;
  const bottomOffset = wide ? 24 : Math.max(insets.bottom, 12) + (Platform.OS === 'web' ? 12 : 56);

  return (
    <View style={[styles.floatingContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            backgroundColor: t.card,
            borderColor: t.border,
            maxWidth: wide ? 640 : undefined,
          },
        ]}>
        {/* Sol: Seçim durumu ve toplam tutar */}
        <View style={styles.left}>
          <View style={[styles.badge, { backgroundColor: t.primary }]}>
            <Text style={[styles.badgeText, { color: t.primaryForeground }]}>{selectedCount}</Text>
          </View>
          <View style={styles.info}>
            <Text style={[styles.countText, { color: t.foreground }]}>
              {selectedCount === totalCount ? 'Tüm faturalar seçildi' : `${selectedCount} / ${totalCount} fatura`}
            </Text>
            <Text style={[styles.amountText, tabular, { color: t.mutedForeground }]}>
              {para(totalAmount, currency)}
            </Text>
          </View>
        </View>

        {/* Sağ: İndirme butonları ya da İlerleme durumu */}
        <View style={styles.right}>
          {exportingText ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={theme.blue} />
              <Text style={[styles.loadingText, { color: t.foreground }]}>{exportingText}</Text>
            </View>
          ) : (
            <>
              <Pressable
                onPress={onExportExcel}
                accessibilityRole="button"
                accessibilityLabel="Seçilenleri Excel olarak indir"
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.btn,
                  {
                    backgroundColor: t.secondary,
                    borderColor: t.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                  hovered && { backgroundColor: t.muted },
                ]}>
                <Icon sf="tablecells" ion="grid-outline" size={14} color={t.foreground} />
                <Text style={[styles.btnText, { color: t.foreground }]}>Excel</Text>
              </Pressable>

              <Pressable
                onPress={onExportPdf}
                accessibilityRole="button"
                accessibilityLabel={isZip ? "Seçilenleri ZIP olarak indir" : "PDF olarak indir"}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.btn,
                  styles.btnPrimary,
                  {
                    backgroundColor: t.primary,
                    opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
                  },
                ]}>
                <Icon
                  sf={isZip ? 'archivebox.fill' : 'arrow.down.doc.fill'}
                  ion={isZip ? 'file-tray-full' : 'download'}
                  size={14}
                  color={t.primaryForeground}
                />
                <Text style={[styles.btnText, { color: t.primaryForeground, fontWeight: '600' }]}>
                  {isZip ? 'ZIP İndir' : 'PDF İndir'}
                </Text>
              </Pressable>

              <Pressable
                onPress={onClearSelection}
                accessibilityRole="button"
                accessibilityLabel="Seçimi temizle"
                hitSlop={8}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.closeBtn,
                  (hovered || pressed) && { backgroundColor: t.muted },
                ]}>
                <Icon sf="xmark" ion="close" size={16} color={t.mutedForeground} weight="semibold" />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  bar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    gap: 1,
  },
  countText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  amountText: {
    fontFamily,
    fontSize: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 6,
    borderWidth: 1,
    cursor: 'pointer',
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    cursor: 'pointer',
  },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  loadingText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
  },
});
