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
import { type EFatura, EFaturaError, type Kontrol, listEFaturalar, totalsByCurrency, type Yon } from '../services/efatura/qnbEfatura';
import { supabase } from '../services/supabase/client';

// RN 0.88 tipleri NativeMethods dışa aktarmıyor (bkz. PeriodPicker)
const SegmentedControl = NativeSegmentedControl as unknown as ComponentType<SegmentedControlProps>;

const YONLER: Yon[] = ['gelen', 'giden'];
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

type Donem = { faturalar: EFatura[]; uyari?: string; bilgi?: string; kontrol?: Kontrol };

/** "49/49 ✓", "48/49 ⚠", sayı yoksa "49" */
function kontrolMetni(k: Kontrol | undefined, liste: number): string {
  if (!k || k.qnb === null) return `${liste}`;
  return `${k.liste}/${k.qnb} ${k.liste >= k.qnb ? '✓' : '⚠'}`;
}

type DenetimSatiri = { label: string; gelen?: string; giden?: string; sorun: boolean };

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
  /** e-Arşiv servisinin kaç kayıt döndürdüğü (liste boşsa nedenini anlamak için) */
  const bilgi = data[key]?.bilgi;
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

  // Son 12 ayın gelen/giden e-Fatura sayılarını QNB'ninkiyle karşılaştırır (sırayla, giriş hatasında durur)
  const [denetim, setDenetim] = useState<DenetimSatiri[] | null>(null);
  const [denetimDurum, setDenetimDurum] = useState<string | null>(null);
  const denetle = async () => {
    const satirlar: DenetimSatiri[] = [];
    setDenetim([]);
    for (let o = 0; o > -12; o--) {
      const r = monthBounds(o);
      const satir: DenetimSatiri = { label: capitalizeTr(r.label), sorun: false };
      for (const y of YONLER) {
        setDenetimDurum(`${capitalizeTr(r.label)} · ${y === 'gelen' ? 'Gelen' : 'Giden'}…`);
        const k = `${y}:${r.from}`;
        try {
          const d: Donem = await listEFaturalar((name, options) => supabase.functions.invoke(name, options), y, r.from, r.to);
          cache.set(k, d);
          setData((cur) => ({ ...cur, [k]: d }));
          const metin = kontrolMetni(d.kontrol, d.faturalar.filter((f) => f.tur !== 'earsiv').length);
          satir[y] = metin;
          if (d.kontrol?.qnb != null && d.kontrol.liste < d.kontrol.qnb) satir.sorun = true;
        } catch (e) {
          satir[y] = 'hata';
          satir.sorun = true;
          if (e instanceof EFaturaError && e.loginFailed) {
            loginFailed = true;
            satirlar.push(satir);
            setDenetim([...satirlar]);
            setDenetimDurum(`Durduruldu: ${errorMessage(e)}`);
            return;
          }
        }
      }
      satirlar.push(satir);
      setDenetim([...satirlar]);
    }
    setDenetimDurum(null);
  };

  /** Elle yenileme: önbelleği ve giriş engelini yok sayar */
  const refresh = () => fetchList(key, yon, range.from, range.to);
  const loading = !items && !error;

  // İptal edilen e-Arşiv faturaları toplama girmez
  const denetimSorun = denetim?.filter((d) => d.sorun).length ?? 0;
  const denetimSuruyor = !!denetimDurum && !denetimDurum.startsWith('Durduruldu');
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
            title="Bazı giden faturalar alınamadı"
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
          message={`${capitalizeTr(range.label)} döneminde ${yonLabel} fatura bulunmuyor.${bilgi ? `\n\n${bilgi}` : ''}`}
        />
      ) : items ? (
        <>
          <ListSection header="Özet">
            <ListRow title="Fatura Sayısı" value={String(items.length)} />
            {data[key]?.kontrol?.qnb != null ? (
              <ListRow
                title="QNB Kontrolü"
                subtitle="Listedeki / QNB'nin saydığı e-Fatura"
                value={kontrolMetni(data[key]?.kontrol, items.length)}
                valueColor={data[key]!.kontrol!.liste >= data[key]!.kontrol!.qnb! ? theme.green : theme.orange}
              />
            ) : null}
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
      <ListSection
        header="Denetim"
        footer={
          denetim && !denetimSuruyor && denetim.length
            ? denetimSorun
              ? `${denetimSorun} ayda QNB'nin saydığı e-Fatura listede tam görünmüyor (⚠). O aya girip uyarıyı okuyun.`
              : 'Son 12 ayın tamamında listedeki e-Fatura sayısı QNB’nin saydığıyla aynı.'
            : 'Her ay için listedeki e-Fatura sayısını QNB’nin kendi sayımıyla karşılaştırır (gelen/giden). Birkaç dakika sürebilir.'
        }>
        <ListRow
          title="Son 12 Ayı Denetle"
          subtitle={denetimDurum ?? undefined}
          icon={{ sf: 'checklist', ion: 'checkmark-done', color: theme.indigo }}
          tone="action"
          disabled={denetimSuruyor}
          accessory={denetimSuruyor ? <ActivityIndicator /> : undefined}
          onPress={denetle}
        />
        {(denetim ?? []).map((d) => (
          <ListRow
            key={d.label}
            title={d.label}
            subtitle={`Gelen ${d.gelen ?? '…'} · Giden ${d.giden ?? '…'}`}
            value={d.sorun ? '⚠' : '✓'}
            valueColor={d.sorun ? theme.orange : theme.green}
          />
        ))}
      </ListSection>
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
