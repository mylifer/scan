import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { fontFamily, tabular, useShadcnTheme, useTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { Checkbox } from '../web/Checkbox';

interface Props {
  selectedCount: number;
  totalCount: number;
  totalAmount: number;
  currency: string;
  allSelected: boolean;
  onToggleSelectAll: () => void;
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
 * e-Fatura listesinde tekli veya çoklu seçim yapıldığında gösterilen
 * dışa aktarma (Excel / PDF) ve toplu işlem çubuğu.
 */
export function EFaturaExportBar({
  selectedCount,
  totalCount,
  totalAmount,
  currency,
  allSelected,
  onToggleSelectAll,
  onClearSelection,
  onExportExcel,
  onExportPdf,
  exportingText,
}: Props) {
  const t = useShadcnTheme();
  const theme = useTheme();

  if (selectedCount === 0) return null;

  return (
    <View style={[styles.bar, { backgroundColor: t.card, borderColor: t.border }]}>
      {/* Sol: Seçim durumu ve Tümünü Seç */}
      <View style={styles.left}>
        <View style={styles.checkWrap}>
          <Checkbox
            checked={allSelected}
            indeterminate={!allSelected && selectedCount > 0}
            onCheckedChange={onToggleSelectAll}
            accessibilityLabel={allSelected ? 'Seçimi kaldır' : 'Tümünü seç'}
          />
        </View>
        <View style={styles.info}>
          <Text style={[styles.countText, { color: t.foreground }]}>
            <Text style={{ fontWeight: '700' }}>{selectedCount}</Text> / {totalCount} fatura seçildi
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
                { backgroundColor: t.secondary, borderColor: t.border },
                (hovered || pressed) && { backgroundColor: t.muted },
              ]}>
              <Icon sf="tablecells" ion="grid-outline" size={14} color={t.foreground} />
              <Text style={[styles.btnText, { color: t.foreground }]}>Excel</Text>
            </Pressable>

            <Pressable
              onPress={onExportPdf}
              accessibilityRole="button"
              accessibilityLabel="Seçilenlerin PDF dosyalarını indir"
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: t.primary },
                (hovered || pressed) && { opacity: 0.9 },
              ]}>
              <Icon sf="arrow.down.doc" ion="download-outline" size={14} color={t.primaryForeground} />
              <Text style={[styles.btnText, { color: t.primaryForeground }]}>
                {selectedCount > 1 ? 'PDF Paketi (ZIP)' : 'PDF İndir'}
              </Text>
            </Pressable>

            <Pressable
              onPress={onClearSelection}
              accessibilityRole="button"
              accessibilityLabel="Seçimi temizle"
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.closeBtn,
                (hovered || pressed) && { opacity: 0.7 },
              ]}>
              <Icon sf="xmark" ion="close" size={16} color={t.mutedForeground} weight="semibold" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkWrap: {
    paddingVertical: 2,
  },
  info: {
    gap: 2,
  },
  countText: {
    fontFamily,
    fontSize: 13,
  },
  amountText: {
    fontFamily,
    fontSize: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
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
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
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
