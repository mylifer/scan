import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EFaturaSort } from '../../lib/efaturaSort';
import { tabular, type as t, useTheme } from '../../lib/theme';
import type { EFatura } from '../../services/efatura/qnbEfatura';

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
  { ad: 'Tarih', flex: 1.3, siralama: ['yeni', 'eski'] },
  { ad: 'Firma', flex: 3, siralama: ['firma'] },
  { ad: 'Belge No', flex: 1.7 },
  { ad: 'Matrah', flex: 1.3, sag: true },
  { ad: 'KDV', flex: 1.2, sag: true, siralama: ['kdv-yuksek'] },
  { ad: 'Tutar', flex: 1.4, sag: true, siralama: ['tutar-yuksek', 'tutar-dusuk'] },
];

/**
 * Masaüstü tarayıcı için fatura tablosu. Sütun başlığına tıklayınca o sütuna göre sıralar
 * (ikinci tıklama tersine çevirir); satıra tıklayınca fatura açılır.
 */
export function EFaturaTable({
  items,
  siralama,
  onSiralama,
  onOpen,
  haric,
}: {
  items: EFatura[];
  siralama: EFaturaSort;
  onSiralama: (s: EFaturaSort) => void;
  onOpen: (f: EFatura) => void;
  haric: ReadonlySet<string>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.table, { backgroundColor: theme.card }]} accessibilityRole="list">
      <View style={[styles.row, styles.head, { borderBottomColor: theme.separator }]}>
        {SUTUNLAR.map((c) => {
          const aktif = c.siralama?.includes(siralama);
          const ok = aktif ? (siralama === c.siralama![0] ? (c.ad === 'Firma' ? '↑' : '↓') : '↑') : '';
          const metin = (
            <Text style={[t.footnote, styles.headText, { color: aktif ? theme.blue : theme.secondaryLabel, textAlign: c.sag ? 'right' : 'left' }]}>
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
      {items.map((f, i) => {
        const soluk = f.iptal || haric.has(f.ettn.toLowerCase());
        const renk = soluk ? theme.secondaryLabel : theme.label;
        const etiketler = [f.tip === 'IADE' ? 'İade' : '', f.tur === 'earsiv' ? 'e-Arşiv' : '', f.iptal ? 'İptal' : '', haric.has(f.ettn.toLowerCase()) ? 'Toplama dahil değil' : '']
          .filter(Boolean)
          .join(' · ');
        return (
          <Pressable
            key={f.ettn || f.belgeNo}
            onPress={f.ettn ? () => onOpen(f) : undefined}
            disabled={!f.ettn}
            accessibilityRole="button"
            accessibilityLabel={`${f.unvan}, ${para(f.tutar, f.paraBirimi)}`}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.row,
              i < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator },
              (hovered || pressed) && { backgroundColor: theme.fill },
            ]}>
            <View style={[styles.cell, { flex: 1.3 }]}>
              <Text style={[t.subhead, tabular, { color: renk }]} numberOfLines={1}>
                {tarihMetni(f.tarih)}
              </Text>
            </View>
            <View style={[styles.cell, { flex: 3 }]}>
              <Text style={[t.subhead, { color: renk }]} numberOfLines={1}>
                {f.unvan}
              </Text>
              {etiketler ? <Text style={[t.caption1, { color: theme.secondaryLabel }]}>{etiketler}</Text> : null}
            </View>
            <View style={[styles.cell, { flex: 1.7 }]}>
              <Text style={[t.subhead, tabular, { color: theme.secondaryLabel }]} numberOfLines={1}>
                {f.belgeNo}
              </Text>
            </View>
            <View style={[styles.cell, { flex: 1.3 }]}>
              <Text style={[t.subhead, tabular, styles.sag, { color: theme.secondaryLabel }]}>{para(f.matrah, f.paraBirimi)}</Text>
            </View>
            <View style={[styles.cell, { flex: 1.2 }]}>
              <Text style={[t.subhead, tabular, styles.sag, { color: renk }]}>{para(f.kdv, f.paraBirimi)}</Text>
            </View>
            <View style={[styles.cell, { flex: 1.4 }]}>
              <Text style={[t.subhead, tabular, styles.sag, { color: renk, fontWeight: '600', textDecorationLine: f.iptal ? 'line-through' : 'none' }]}>
                {para(f.tutar, f.paraBirimi)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { marginHorizontal: 16, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 48 },
  head: { minHeight: 40, borderBottomWidth: StyleSheet.hairlineWidth },
  headText: { fontWeight: '600', letterSpacing: 0.3 },
  cell: { paddingHorizontal: 8, paddingVertical: 8, minWidth: 0 },
  sag: { textAlign: 'right' },
});
