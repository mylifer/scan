import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EFaturaSort } from '../../lib/efaturaSort';
import { fontFamily, tabular, useShadcnTheme } from '../../lib/theme';
import { prefetchInvoicePdf } from '../../services/efatura/pdfCache';
import type { EFatura, Yon } from '../../services/efatura/qnbEfatura';
import { Icon } from '../ui/Icon';
import { Badge } from '../web/Badge';
import { Checkbox } from '../web/Checkbox';

const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function tarihMetni(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return y && m && d ? `${d} ${AY[m - 1]} ${y}` : '—';
}

function para(value: number | undefined, currency: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

type Sutun = { ad: string; flex: number; sag?: boolean; siralama?: [EFaturaSort, EFaturaSort?] };

const SUTUNLAR: Sutun[] = [
  { ad: 'Tarih', flex: 1.1, siralama: ['yeni', 'eski'] },
  { ad: 'Firma', flex: 2.8, siralama: ['firma'] },
  { ad: 'Belge No', flex: 1.4 },
  { ad: 'Matrah', flex: 1.1, sag: true },
  { ad: 'KDV', flex: 1.0, sag: true, siralama: ['kdv-yuksek'] },
  { ad: 'Tutar', flex: 1.2, sag: true, siralama: ['tutar-yuksek', 'tutar-dusuk'] },
  { ad: 'İşlem', flex: 1.4, sag: true },
];

/**
 * Masaüstü tarayıcı için Shadcn UI tablosu.
 */
export function EFaturaTable({
  items,
  yon,
  siralama,
  onSiralama,
  onOpen,
  onViewPdf,
  haric,
  selected,
  onToggleSelect,
  onToggleSelectAll,
}: {
  items: EFatura[];
  yon: Yon;
  siralama: EFaturaSort;
  onSiralama: (s: EFaturaSort) => void;
  onOpen: (f: EFatura) => void;
  onViewPdf?: (f: EFatura) => void;
  haric: ReadonlySet<string>;
  selected?: ReadonlySet<string>;
  onToggleSelect?: (ettn: string) => void;
  onToggleSelectAll?: () => void;
}) {
  const t = useShadcnTheme();

  return (
    <View style={[styles.table, { backgroundColor: t.card, borderColor: t.border }]} accessibilityRole="list">
      {/* Table Header */}
      <View style={[styles.row, styles.head, { borderBottomColor: t.border, backgroundColor: t.muted }]}>
        {onToggleSelectAll && (
          <View style={[styles.cell, styles.checkCell]}>
            <Checkbox
              checked={items.length > 0 && items.every((f) => !!f.ettn && selected?.has(f.ettn.toLowerCase()))}
              indeterminate={
                items.some((f) => !!f.ettn && selected?.has(f.ettn.toLowerCase())) &&
                !items.every((f) => !!f.ettn && selected?.has(f.ettn.toLowerCase()))
              }
              onCheckedChange={onToggleSelectAll}
              accessibilityLabel="Tümünü seç"
            />
          </View>
        )}
        {SUTUNLAR.map((c) => {
          const aktif = c.siralama?.includes(siralama);
          const ok = aktif ? (siralama === c.siralama![0] ? (c.ad === 'Firma' ? '↑' : '↓') : '↑') : '';
          const metin = (
            <Text
              style={[
                styles.headText,
                {
                  color: aktif ? t.foreground : t.mutedForeground,
                  textAlign: c.sag ? 'right' : 'left',
                  fontWeight: aktif ? '700' : '600',
                },
              ]}>
              {c.ad.toLocaleUpperCase('tr-TR')} {ok}
            </Text>
          );
          return c.siralama ? (
            <Pressable
              key={c.ad}
              style={[styles.cell, { flex: c.flex }]}
              accessibilityRole="button"
              accessibilityLabel={`${c.ad} sütununa göre sırala`}
              onPress={() => {
                const [ilk, ikinci] = c.siralama!;
                onSiralama(siralama === ilk && ikinci ? ikinci : ilk);
              }}>
              {metin}
            </Pressable>
          ) : (
            <View key={c.ad} style={[styles.cell, { flex: c.flex }]}>
              {metin}
            </View>
          );
        })}
      </View>

      {/* Table Body */}
      {items.map((f, i) => {
        const isHaric = haric.has(f.ettn.toLowerCase());
        const isSelected = !!f.ettn && !!selected?.has(f.ettn.toLowerCase());
        const soluk = f.iptal || isHaric;
        const renk = soluk ? t.mutedForeground : t.cardForeground;

        return (
          <Pressable
            key={f.ettn || f.belgeNo}
            onPress={f.ettn ? () => onOpen(f) : undefined}
            onHoverIn={() => {
              if (f.ettn) prefetchInvoicePdf(yon, f.ettn, f.tur);
            }}
            disabled={!f.ettn}
            accessibilityRole="button"
            accessibilityLabel={`${f.unvan}, ${para(f.tutar, f.paraBirimi)}`}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.row,
              isSelected && { backgroundColor: t.secondary },
              i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
              (hovered || pressed) && { backgroundColor: t.muted },
            ]}>
            {/* Seçim Kutusu */}
            {onToggleSelect && (
              <Pressable
                onPress={(e) => {
                  (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                  if (f.ettn) onToggleSelect(f.ettn);
                }}
                disabled={!f.ettn}
                accessibilityRole="button"
                accessibilityLabel={`${f.unvan} faturasını seç`}
                style={[styles.cell, styles.checkCell]}>
                <Checkbox
                  checked={isSelected}
                  disabled={!f.ettn}
                  onCheckedChange={() => f.ettn && onToggleSelect(f.ettn)}
                  accessibilityLabel={`${f.unvan} faturasını seç`}
                />
              </Pressable>
            )}

            {/* Tarih */}
            <View style={[styles.cell, { flex: 1.1 }]}>
              <Text style={[styles.dateText, tabular, { color: renk }]} numberOfLines={1}>
                {tarihMetni(f.tarih)}
              </Text>
            </View>

            {/* Firma ve Rozetler */}
            <View style={[styles.cell, { flex: 2.8, gap: 4 }]}>
              <Text style={[styles.titleText, { color: renk }]} numberOfLines={1}>
                {f.unvan}
              </Text>
              <View style={styles.badgeRow}>
                {f.tur === 'earsiv' && (
                  <Badge variant="outline" style={styles.badge}>
                    e-Arşiv
                  </Badge>
                )}
                {f.tip === 'IADE' && (
                  <Badge variant="destructive" style={styles.badge}>
                    İade
                  </Badge>
                )}
                {f.iptal && (
                  <Badge variant="secondary" style={styles.badge}>
                    İptal
                  </Badge>
                )}
                {isHaric && (
                  <Badge variant="secondary" style={styles.badge}>
                    Hariç
                  </Badge>
                )}
              </View>
            </View>

            {/* Belge No */}
            <View style={[styles.cell, { flex: 1.4 }]}>
              <Text style={[styles.monoText, tabular, { color: t.mutedForeground }]} numberOfLines={1}>
                {f.belgeNo}
              </Text>
            </View>

            {/* Matrah */}
            <View style={[styles.cell, { flex: 1.1 }]}>
              <Text style={[styles.amountText, tabular, styles.sag, { color: t.mutedForeground }]}>
                {para(f.matrah, f.paraBirimi)}
              </Text>
            </View>

            {/* KDV */}
            <View style={[styles.cell, { flex: 1.0 }]}>
              <Text style={[styles.amountText, tabular, styles.sag, { color: renk }]}>
                {para(f.kdv, f.paraBirimi)}
              </Text>
            </View>

            {/* Tutar */}
            <View style={[styles.cell, { flex: 1.2 }]}>
              <Text
                style={[
                  styles.totalText,
                  tabular,
                  styles.sag,
                  {
                    color: renk,
                    textDecorationLine: f.iptal ? 'line-through' : 'none',
                  },
                ]}>
                {para(f.tutar, f.paraBirimi)}
              </Text>
            </View>

            {/* İşlem (PDF Görüntüle) */}
            <View style={[styles.cell, { flex: 1.4, alignItems: 'flex-end', justifyContent: 'center' }]}>
              {f.ettn && onViewPdf ? (
                <Pressable
                  onPress={(e) => {
                    (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                    onViewPdf(f);
                  }}
                  onHoverIn={() => {
                    prefetchInvoicePdf(yon, f.ettn, f.tur);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${f.unvan} faturasının PDF'ini görüntüle`}
                  style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                    styles.pdfBtn,
                    {
                      backgroundColor: hovered ? t.secondary : t.muted,
                      borderColor: t.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}>
                  <Icon sf="doc.text.fill" ion="document-text-outline" size={13} color={t.cardForeground} />
                  <Text style={[styles.pdfBtnText, { color: t.cardForeground }]}>PDF Görüntüle</Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    marginHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 48,
  },
  head: {
    minHeight: 38,
    borderBottomWidth: 1,
  },
  headText: {
    fontFamily,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 0,
    justifyContent: 'center',
  },
  checkCell: {
    width: 44,
    flex: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  sag: {
    textAlign: 'right',
  },
  dateText: {
    fontFamily,
    fontSize: 13,
  },
  titleText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '500',
  },
  monoText: {
    fontFamily,
    fontSize: 12,
  },
  amountText: {
    fontFamily,
    fontSize: 13,
  },
  totalText: {
    fontFamily,
    fontSize: 13,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  pdfBtnText: {
    fontFamily,
    fontSize: 12,
    fontWeight: '500',
  },
});
