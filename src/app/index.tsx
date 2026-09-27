import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDrafts } from '../hooks/useDrafts';
import { useMonthlySummary } from '../hooks/useMonthlySummary';
import { confirmAction, showAlert } from '../lib/alert';
import { formatRunAt } from '../lib/schedule';
import { showToast } from '../lib/toast';
import { formatTL, isoToTrDate } from '../lib/format';
import { colors, kategoriMeta } from '../lib/theme';
import { supabase } from '../services/supabase/client';
import type { ReceiptRecord } from '../types/receipt';

const PAGE = 20;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { summary, loading, error, refresh, remove, period, label, showMonthly, showAll, prevMonth, nextMonth } =
    useMonthlySummary();
  const s = summary;
  const isMonth = period.mode === 'month';
  const offset = isMonth ? period.offset : 0;
  const [visible, setVisible] = useState(PAGE);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { drafts, processor } = useDrafts();
  const readyDrafts = drafts.filter((d) => d.status === 'ready').length;
  const nextScheduled = drafts.find((d) => d.status === 'scheduled' && d.scheduled_for)?.scheduled_for;

  // Dönem değişince listeyi baştan göster
  useEffect(() => setVisible(PAGE), [label]);

  function confirmDelete(r: ReceiptRecord) {
    confirmAction(
      'Fişi sil',
      `${r.firma_adi} · ${isoToTrDate(r.tarih)} · ${formatTL(r.toplam_tutar)}\n\nBu fiş kalıcı olarak silinecek.`,
      'Sil',
      async () => {
        setDeletingId(r.id);
        try {
          await remove(r);
          showToast('Fiş silindi', 'info');
        } catch (e) {
          showAlert('Silinemedi', (e as Error).message);
        } finally {
          setDeletingId(null);
        }
      },
    );
  }
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
          <View style={{ flex: 1 }}>
            <Text style={styles.overline}>Gider Özeti</Text>
            <View style={styles.monthRow}>
              {isMonth && (
                <Pressable onPress={prevMonth} hitSlop={10} style={styles.monthArrow}>
                  <Text style={styles.monthArrowText}>‹</Text>
                </Pressable>
              )}
              <Text style={styles.month}>{capitalize(label)}</Text>
              {isMonth && (
                <Pressable
                  onPress={nextMonth}
                  disabled={offset === 0}
                  hitSlop={10}
                  style={[styles.monthArrow, offset === 0 && { opacity: 0.25 }]}>
                  <Text style={styles.monthArrowText}>›</Text>
                </Pressable>
              )}
            </View>
          </View>
          <Pressable onPress={confirmSignOut} style={styles.avatar} hitSlop={8}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </Pressable>
        </View>

        <View style={styles.segment}>
          <Pressable onPress={showMonthly} style={[styles.segmentItem, isMonth && styles.segmentActive]}>
            <Text style={[styles.segmentText, isMonth && styles.segmentTextActive]}>Aylık</Text>
          </Pressable>
          <Pressable onPress={showAll} style={[styles.segmentItem, !isMonth && styles.segmentActive]}>
            <Text style={[styles.segmentText, !isMonth && styles.segmentTextActive]}>Tüm zamanlar</Text>
          </Pressable>
        </View>

        {error && (
          <Pressable onPress={refresh} style={styles.error}>
            <Text style={styles.errorText}>Veriler alınamadı: {error}</Text>
            <Text style={[styles.errorText, { fontWeight: '700' }]}>Tekrar denemek için dokunun</Text>
          </Pressable>
        )}

        {(drafts.length > 0 || processor.running) && (
          <Pressable onPress={() => router.push('/batch')} style={styles.draftBanner}>
            <Text style={{ fontSize: 22 }}>📚</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.draftTitle}>
                {processor.running ? `Taranıyor ${processor.done}/${processor.total}` : `${drafts.length} taslak fiş`}
              </Text>
              <Text style={styles.draftSub}>
                {readyDrafts
                  ? `${readyDrafts} fiş incelemeye hazır`
                  : nextScheduled
                    ? `⏰ ${formatRunAt(nextScheduled)} için planlı`
                    : 'Toplu taramaya dokunun'}
              </Text>
            </View>
            <Text style={styles.draftChevron}>›</Text>
          </Pressable>
        )}

        <LinearGradient colors={[colors.heroFrom, colors.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroLabel}>{!isMonth ? 'Tüm zamanlardaki toplam gider' : offset === 0 ? 'Bu ayki toplam gider' : `${capitalize(label)} toplam gideri`}</Text>
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
          {s && s.kategoriToplamlari.length === 0 && <Text style={styles.empty}>Bu dönemde fiş yok.</Text>}
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

        {!!s?.fisler.length && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fişler ({s.fisler.length})</Text>
            {s.fisler.slice(0, visible).map((r, i) => (
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
                <Pressable
                  onPress={() => confirmDelete(r)}
                  disabled={deletingId === r.id}
                  hitSlop={8}
                  style={styles.deleteBtn}
                  accessibilityLabel="Fişi sil">
                  {deletingId === r.id ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Text style={styles.deleteText}>🗑️</Text>
                  )}
                </Pressable>
              </View>
            ))}
            {s.fisler.length > visible && (
              <Pressable onPress={() => setVisible((v) => v + PAGE)} style={styles.moreBtn}>
                <Text style={styles.moreText}>Daha fazla göster ({s.fisler.length - visible})</Text>
              </Pressable>
            )}
          </View>
        )}

        <Text style={styles.version}>Sürüm {(process.env.EXPO_PUBLIC_APP_VERSION ?? 'geliştirme').slice(0, 7)}</Text>
      </ScrollView>

      <View style={[styles.fabWrap, { bottom: insets.bottom + 20 }]}>
        <Pressable
          onPress={() => router.push('/camera')}
          style={({ pressed }) => [styles.fab, { flex: 1 }, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Text style={styles.fabText}>📷  Fiş Tara</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/batch')}
          style={({ pressed }) => [styles.fab, styles.fabSecondary, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Text style={[styles.fabText, { color: colors.text }]}>📚  Toplu</Text>
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
  month: { fontSize: 24, fontWeight: '800', color: colors.text },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowText: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: -2 },
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
  segment: { flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  segmentActive: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  segmentTextActive: { color: colors.text },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { fontSize: 15 },
  moreBtn: { paddingVertical: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  moreText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  version: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 4 },
  fabWrap: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10 },
  fabSecondary: { backgroundColor: colors.card, paddingHorizontal: 20, borderWidth: 1, borderColor: colors.border },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  draftTitle: { fontSize: 15, fontWeight: '700', color: '#4C1D95' },
  draftSub: { fontSize: 13, color: '#6D28D9', marginTop: 2 },
  draftChevron: { fontSize: 24, color: '#6D28D9', fontWeight: '700' },
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
