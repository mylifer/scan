import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { confirmAction } from '../lib/alert';
import { formatTL, isoToTrDate } from '../lib/format';
import { colors, kategoriMeta } from '../lib/theme';
import { supabase } from '../services/supabase/client';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { summary, loading, error, refresh, monthLabel } = useMonthlySummary();
  const s = summary;
  const maxKategori = Math.max(1, ...(s?.kategoriToplamlari.map((k) => k.toplam) ?? [1]));

  function confirmSignOut() {
    confirmAction('Çıkış yap', 'Hesabınızdan çıkmak istiyor musunuz?', 'Çıkış yap', () => supabase.auth.signOut());
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={loading && !!summary} onRefresh={refresh} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.overline}>Gider Özeti</Text>
            <Text style={styles.month}>{capitalize(monthLabel)}</Text>
          </View>
          <Pressable onPress={confirmSignOut} style={styles.avatar} hitSlop={8}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </Pressable>
        </View>

        {error && (
          <Pressable onPress={refresh} style={styles.error}>
            <Text style={styles.errorText}>Veriler alınamadı: {error}</Text>
            <Text style={[styles.errorText, { fontWeight: '700' }]}>Tekrar denemek için dokunun</Text>
          </Pressable>
        )}

        <LinearGradient colors={[colors.heroFrom, colors.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>Bu ayki toplam gider</Text>
          <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>
            {s ? formatTL(s.toplamGider) : '—'}
          </Text>
          <View style={styles.heroFooter}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>🧾 {s?.fisSayisi ?? 0} fiş</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>KDV hariç {s ? formatTL(s.toplamGider - s.toplamKdv) : '—'}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.kdvHeader}>
            <View>
              <Text style={styles.cardLabel}>Toplam KDV alacağı</Text>
              <Text style={styles.kdvValue}>{s ? formatTL(s.toplamKdv) : '—'}</Text>
            </View>
            <View style={styles.kdvBadge}>
              <Text style={{ fontSize: 22 }}>💰</Text>
            </View>
          </View>
          <View style={styles.kdvRow}>
            <KdvCell label="%1" value={s?.kdv1} />
            <KdvCell label="%10" value={s?.kdv10} />
            <KdvCell label="%20" value={s?.kdv20} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kategorilere göre</Text>
          {s && s.kategoriToplamlari.length === 0 && <Text style={styles.empty}>Bu ay henüz fiş yok.</Text>}
          {s?.kategoriToplamlari.map(({ kategori, toplam }) => {
            const meta = kategoriMeta[kategori] ?? { emoji: '•', color: colors.primary };
            return (
              <View key={kategori} style={{ gap: 6 }}>
                <View style={styles.catRow}>
                  <Text style={styles.catName}>
                    {meta.emoji} {capitalize(kategori)}
                  </Text>
                  <Text style={styles.catValue}>{formatTL(toplam)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(toplam / maxKategori) * 100}%`, backgroundColor: meta.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {!!s?.sonFisler.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Son fişler</Text>
            {s.sonFisler.map((r, i) => (
              <View key={r.id} style={[styles.receiptRow, i > 0 && styles.divider]}>
                <View style={[styles.receiptIcon, { backgroundColor: `${kategoriMeta[r.kategori]?.color ?? colors.primary}1A` }]}>
                  <Text>{kategoriMeta[r.kategori]?.emoji ?? '🧾'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptName} numberOfLines={1}>
                    {r.firma_adi}
                  </Text>
                  <Text style={styles.receiptMeta}>
                    {isoToTrDate(r.tarih)} · KDV {formatTL(r.toplam_kdv)}
                  </Text>
                </View>
                <Text style={styles.receiptAmount}>{formatTL(r.toplam_tutar)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.fabWrap, { bottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={() => router.push('/camera')}
          style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Text style={styles.fabText}>📷  Fiş Tara</Text>
        </Pressable>
      </View>
    </View>
  );
}

function KdvCell({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.kdvCell}>
      <Text style={styles.kdvCellLabel}>{label}</Text>
      <Text style={styles.kdvCellValue} numberOfLines={1} adjustsFontSizeToFit>
        {value === undefined ? '—' : formatTL(value)}
      </Text>
    </View>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  overline: { fontSize: 13, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  month: { fontSize: 26, fontWeight: '800', color: colors.text },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12, gap: 2 },
  errorText: { color: colors.danger, fontSize: 13 },
  hero: { borderRadius: 24, padding: 22, gap: 6 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  heroValue: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -0.5 },
  heroFooter: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  pill: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLabel: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  kdvHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kdvValue: { fontSize: 30, fontWeight: '800', color: colors.success, marginTop: 2 },
  kdvBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kdvRow: { flexDirection: 'row', gap: 8 },
  kdvCell: { flex: 1, backgroundColor: colors.bg, borderRadius: 12, padding: 10, gap: 2 },
  kdvCellLabel: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  kdvCellValue: { fontSize: 14, color: colors.text, fontWeight: '700' },
  empty: { color: colors.muted, fontSize: 14 },
  catRow: { flexDirection: 'row', justifyContent: 'space-between' },
  catName: { fontSize: 14, color: colors.text, fontWeight: '600' },
  catValue: { fontSize: 14, color: colors.text, fontWeight: '700' },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  receiptIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  receiptName: { fontSize: 15, fontWeight: '600', color: colors.text },
  receiptMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  receiptAmount: { fontSize: 15, fontWeight: '700', color: colors.text },
  fabWrap: { position: 'absolute', left: 16, right: 16 },
  fab: {
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
