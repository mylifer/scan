import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTL, shortTrDate } from '../../lib/format';
import type { SortKey } from '../../lib/sort';
import { categoryMeta, fontFamily, tabular, useShadcnTheme } from '../../lib/theme';
import type { ReceiptRecord } from '../../types/receipt';
import { Icon } from '../ui/Icon';
import { Badge } from './Badge';
import { Checkbox } from './Checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table';

interface ReceiptTableProps {
  receipts: ReceiptRecord[];
  sort?: SortKey;
  onSort?: (s: SortKey) => void;
  onOpen: (r: ReceiptRecord) => void;
  onDelete?: (r: ReceiptRecord) => void;
  selected?: ReadonlySet<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  selecting?: boolean;
}

/**
 * Masaüstü web için Shadcn UI Fiş Tablosu bileşeni.
 */
export function ReceiptTable({
  receipts,
  sort,
  onSort,
  onOpen,
  onDelete,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  selecting,
}: ReceiptTableProps) {
  const t = useShadcnTheme();

  const allSelected = receipts.length > 0 && receipts.every((r) => selected?.has(r.id));
  const someSelected = receipts.some((r) => selected?.has(r.id)) && !allSelected;

  return (
    <Table style={styles.table}>
      <TableHeader>
        <TableRow isHeader style={{ backgroundColor: t.muted }}>
          {selecting && (
            <View style={styles.checkCol}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={() => onToggleSelectAll?.()}
                accessibilityLabel="Tümünü seç"
              />
            </View>
          )}

          <TableHead
            flex={1.2}
            onPress={onSort ? () => onSort(sort === 'newest' ? 'oldest' : 'newest') : undefined}>
            TARİH {sort === 'newest' ? '↓' : sort === 'oldest' ? '↑' : ''}
          </TableHead>

          <TableHead flex={2.8}>FİRMA</TableHead>

          <TableHead flex={1.6}>KATEGORİ</TableHead>

          <TableHead flex={1.2} align="right">
            KDV
          </TableHead>

          <TableHead
            flex={1.4}
            align="right"
            onPress={onSort ? () => onSort(sort === 'highest' ? 'lowest' : 'highest') : undefined}>
            TUTAR {sort === 'highest' ? '↓' : sort === 'lowest' ? '↑' : ''}
          </TableHead>

          <TableHead flex={1.2} align="right">
            İŞLEM
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {receipts.map((r, i) => {
          const isSelected = !!selected?.has(r.id);
          const meta = categoryMeta(r.kategori);

          return (
            <TableRow
              key={r.id}
              onPress={() => (selecting ? onToggleSelect?.(r.id) : onOpen(r))}
              isLast={i === receipts.length - 1}
              style={[
                styles.row,
                isSelected && { backgroundColor: t.secondary },
              ]}>
              {selecting && (
                <Pressable
                  onPress={(e) => {
                    (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                    onToggleSelect?.(r.id);
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${r.firma_adi} fişini seç`}
                  style={styles.checkCol}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelect?.(r.id)}
                    accessibilityLabel={`${r.firma_adi} fişini seç`}
                  />
                </Pressable>
              )}

              {/* Tarih */}
              <TableCell flex={1.2}>
                <Text style={[styles.cellText, tabular, { color: t.cardForeground }]}>
                  {shortTrDate(r.tarih)}
                </Text>
              </TableCell>

              {/* Firma & Etiketler */}
              <TableCell flex={2.8}>
                <View style={styles.firmCell}>
                  <Text style={[styles.firmText, { color: t.cardForeground }]} numberOfLines={1}>
                    {r.firma_adi}
                  </Text>
                  {r.etiketler && r.etiketler.length > 0 ? (
                    <View style={styles.tagRow}>
                      {r.etiketler.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" style={styles.tagBadge}>
                          #{tag}
                        </Badge>
                      ))}
                    </View>
                  ) : null}
                </View>
              </TableCell>

              {/* Kategori */}
              <TableCell flex={1.6}>
                <Badge variant="outline" style={styles.categoryBadge}>
                  <Text style={[styles.categoryText, { color: t.foreground }]}>{meta.label}</Text>
                </Badge>
              </TableCell>

              {/* KDV */}
              <TableCell flex={1.2} align="right">
                <Text style={[styles.cellText, tabular, { color: t.mutedForeground }]}>
                  {formatTL(r.toplam_kdv)}
                </Text>
              </TableCell>

              {/* Tutar */}
              <TableCell flex={1.4} align="right">
                <Text style={[styles.amountText, tabular, { color: t.cardForeground }]}>
                  {formatTL(r.toplam_tutar)}
                </Text>
              </TableCell>

              {/* İşlem */}
              <TableCell flex={1.2} align="right">
                <View style={styles.actionRow}>
                  {r.muhasebe_gonderildi_at ? (
                    <View style={styles.sentBadge} accessibilityLabel="Muhasebeye gönderildi">
                      <Icon sf="paperplane.fill" ion="paper-plane" size={13} color="#22c55e" />
                    </View>
                  ) : null}
                  {onDelete && !selecting ? (
                    <Pressable
                      onPress={(e) => {
                        (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                        onDelete(r);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${r.firma_adi} fişini sil`}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                        styles.deleteBtn,
                        (hovered || pressed) && { backgroundColor: t.muted },
                      ]}>
                      <Icon sf="trash" ion="trash-outline" size={14} color={t.mutedForeground} />
                    </Pressable>
                  ) : null}
                </View>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

const styles = StyleSheet.create({
  table: {
    marginHorizontal: 0,
    width: '100%',
  },
  row: {
    paddingLeft: 4,
    paddingRight: 8,
    minHeight: 46,
  },
  checkCol: {
    width: 44,
    minWidth: 44,
    maxWidth: 44,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 44,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cellText: {
    fontFamily,
    fontSize: 13,
  },
  firmCell: {
    gap: 2,
    justifyContent: 'center',
  },
  firmText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '500',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  tagBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
  },
  amountText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  sentBadge: {
    padding: 4,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    cursor: 'pointer',
  },
});
