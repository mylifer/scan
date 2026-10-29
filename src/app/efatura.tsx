import NativeSegmentedControl, { type SegmentedControlProps } from '@react-native-segmented-control/segmented-control';
import { router } from 'expo-router';
import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { ListRow, ListSection } from '../components/ui/List';
import { errorMessage } from '../lib/errors';
import { capitalizeTr, monthRange } from '../lib/format';
import { haptics } from '../lib/haptics';
import { type as t, useTheme } from '../lib/theme';
import { type EFatura, EFaturaError, listEFaturalar, totalsByCurrency, type Yon } from '../services/efatura/qnbEfatura';
import { supabase } from '../services/supabase/client';

// RN 0.88 tipleri NativeMethods dışa aktarmıyor (bkz. PeriodPicker)
const SegmentedControl = NativeSegmentedControl as unknown as ComponentType<SegmentedControlProps>;

const YONLER: Yon[] = ['gelen', 'giden'];
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

type Donem = { faturalar: EFatura[]; uyari?: string };

/** Uygulama açıkken sekme/ay değişince QNB'ye yeniden sorulmasın */
const cache = new Map<string, Donem>();
/** QNB girişi başarısız olduysa otomatik yükleme durur (hesap kilitlenmesin); yalnızca elle denenir */
let loginFailed = false;

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function dayMonth(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return m && d ? `${d} ${AY[m - 1]}` : '—';
}

/** Ayın ilk ve son günü (QNB'de bitiş tarihi dahildir) */
function monthBounds(offset: number) {
  const r = monthRange(offset);
  const [y, m] = r.from.split('-').map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return { from: r.from, to: `${r.from.slice(0, 8)}${String(last).padStart(2, '0')}`, label: r.label };
}

/** QNB eSolutions'taki gelen ve giden e-faturalar (yalnızca görüntüleme). */
export default function EFaturaScreen() {
  const theme = useTheme();
  const [yon, setYon] = useState<Yon>('gelen');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Record<string, Donem>>(() => Object.fromEntries(cache));
  const [errors, setErrors] = useState<Record<string, { message: string; login: boolean }>>({});
  const [pulling, setPulling] = useState(false);
  /** Elle denenen istek sürüyor mu (dokununca geri bildirim için) */
  const [busy, setBusy] = useState<string | null>(null);
  /** Aynı dönem için aynı anda tek istek */
  const inflight = useRef(new Set<string>());

  const range = monthBounds(offset);
  const key = `${yon}:${range.from}`;
  const items = data[key]?.faturalar;
  const uyari = data[key]?.uyari;
  const error =
    errors[key] ??
    (loginFailed && !items ? { message: 'QNB girişi daha önce başarısız oldu. Bilgileri kontrol ettikten sonra elle tekrar deneyin.', login: true } : undefined);

  const fetchList = useCallback(async (k: string, y: Yon, from: string, to: string) => {
    if (inflight.current.has(k)) return;
    inflight.current.add(k);
    setBusy(k);
    try {
      const list: Donem = await listEFaturalar((name, options) => supabase.functions.invoke(name, options), y, from, to);
      loginFailed = false;
      cache.set(k, list);
      setData((d) => ({ ...d, [k]: list }));
      setErrors(({ [k]: _, ...rest }) => rest);
    } catch (e) {
      const login = e instanceof EFaturaError && e.loginFailed;
      if (login) loginFailed = true;
      setErrors((cur) => ({ ...cur, [k]: { message: errorMessage(e), login } }));
    } finally {
      inflight.current.delete(k);
      setBusy((b) => (b === k ? null : b));
    }
  }, []);

  // Dönem ilk kez açılınca getir (önbellekte varsa ya da QNB girişi başarısızsa sorma)
  useEffect(() => {
    if (!items && !errors[key] && !loginFailed) void fetchList(key, yon, range.from, range.to);
  }, [items, errors, key, yon, range.from, range.to, fetchList]);

  /** Elle yenileme: önbelleği ve giriş engelini yok sayar */
  const refresh = () => fetchList(key, yon, range.from, range.to);
  const loading = !items && !error;

  // İptal edilen e-Arşiv faturaları toplama girmez
  const totals = items ? totalsByCurrency(items.filter((f) => !f.iptal)) : [];
  const yonLabel = yon === 'gelen' ? 'gelen' : 'giden';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={async () => {
            setPulling(true);
            await refresh();
            setPulling(false);
          }}
        />
      }>
      <View style={styles.controls}>
        <SegmentedControl
          values={['Gelen', 'Giden']}
          selectedIndex={YONLER.indexOf(yon)}
          onChange={(e) => {
            haptics.select();
            const next = YONLER[e.nativeEvent.selectedSegmentIndex];
            if (next) setYon(next);
          }}
          appearance={theme.dark ? 'dark' : 'light'}
        />
        <View style={styles.monthRow}>
          <MonthButton dir="left" label="Önceki ay" onPress={() => setOffset((o) => o - 1)} />
          <Text style={[t.headline, { color: theme.label }]}>{capitalizeTr(range.label)}</Text>
          <MonthButton dir="right" label="Sonraki ay" disabled={offset === 0} onPress={() => setOffset((o) => Math.min(0, o + 1))} />
        </View>
      </View>

      {error && (
        <ListSection
          footer={
            error.login
              ? `${error.message}\n\nHesabınız kilitlenmesin diye otomatik olarak tekrar denenmez. Sunucu da 15 dakika boyunca QNB’ye istek atmaz.`
              : error.message
          }>
          <ListRow
            title={error.login ? 'QNB girişi başarısız' : 'Faturalar alınamadı'}
            subtitle={busy === key ? 'Deneniyor…' : 'Tekrar denemek için dokunun'}
            tone="action"
            disabled={busy === key}
            accessory={busy === key ? <ActivityIndicator /> : undefined}
            onPress={refresh}
          />
        </ListSection>
      )}

      {uyari ? (
        <ListSection footer={uyari}>
          <ListRow
            title="e-Arşiv faturaları alınamadı"
            icon={{ sf: 'exclamationmark.triangle.fill', ion: 'warning', color: theme.orange }}
            subtitle={busy === key ? 'Deneniyor…' : 'Tekrar denemek için dokunun'}
            tone="action"
            disabled={busy === key}
            accessory={busy === key ? <ActivityIndicator /> : undefined}
            onPress={refresh}
          />
        </ListSection>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : items && items.length === 0 ? (
        <EmptyState
          icon={{ sf: 'doc.text.magnifyingglass', ion: 'document-text-outline' }}
          title="Fatura Yok"
          message={`${capitalizeTr(range.label)} döneminde ${yonLabel} e-fatura bulunmuyor.`}
        />
      ) : items ? (
        <>
          <ListSection header="Özet">
            <ListRow title="Fatura Sayısı" value={String(items.length)} />
            {totals.map((x) => (
              <ListRow key={x.paraBirimi} title={totals.length > 1 ? `Toplam (${x.paraBirimi})` : 'Toplam'} value={money(x.toplam, x.paraBirimi)} valueColor={theme.label} />
            ))}
          </ListSection>
          <ListSection
            header={yon === 'gelen' ? 'Gelen faturalar' : 'Giden faturalar'}
            footer={
              yon === 'gelen'
                ? 'QNB eSolutions’tan fatura tarihine göre listelenir. Tutar, faturadaki ödenecek tutardır.'
                : 'e-Fatura (gönderim tarihine göre) ve e-Arşiv faturaları birlikte listelenir. İptal edilenler toplama girmez.'
            }>
            {items.map((f) => (
              <ListRow
                key={f.ettn || f.belgeNo}
                icon={{ sf: yon === 'gelen' ? 'tray.and.arrow.down.fill' : 'paperplane.fill', ion: yon === 'gelen' ? 'download' : 'send', color: f.iptal ? theme.gray : yon === 'gelen' ? theme.blue : theme.green }}
                title={f.unvan}
                subtitle={[dayMonth(f.tarih), f.belgeNo, f.tur === 'earsiv' ? 'e-Arşiv' : '', f.iptal ? 'İptal' : ''].filter(Boolean).join(' · ')}
                value={money(f.tutar, f.paraBirimi)}
                valueColor={f.iptal ? theme.secondaryLabel : theme.label}
                chevron={!!f.ettn}
                onPress={
                  f.ettn
                    ? () => router.push({ pathname: '/efatura-detay', params: { yon, ettn: f.ettn, unvan: f.unvan, tur: f.tur ?? 'efatura', belgeNo: f.belgeNo } })
                    : undefined
                }
              />
            ))}
          </ListSection>
        </>
      ) : null}
    </ScrollView>
  );
}

function MonthButton({ dir, label, onPress, disabled }: { dir: 'left' | 'right'; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
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
});
