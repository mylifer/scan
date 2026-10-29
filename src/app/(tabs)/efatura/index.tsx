import NativeSegmentedControl, { type SegmentedControlProps } from '@react-native-segmented-control/segmented-control';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { type ComponentType, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '../../../components/ui/EmptyState';
import { Icon } from '../../../components/ui/Icon';
import { ListRow, ListSection } from '../../../components/ui/List';
import { showActionSheet } from '../../../lib/actionSheet';
import { HARIC_KEY } from '../../../lib/efaturaOzet';
import { EFATURA_SORT_KEY, EFATURA_SORTS, type EFaturaSort, isEFaturaSort, sortEFaturalar } from '../../../lib/efaturaSort';
import { errorMessage } from '../../../lib/errors';
import { capitalizeTr, monthRange } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { type as t, useTheme } from '../../../lib/theme';
import { type EFatura, EFaturaError, type Kontrol, totalsByCurrency, type Yon } from '../../../services/efatura/qnbEfatura';
import { donemCache as cache, donemGetir, type Donem, qnbDurum } from '../../../services/efatura/donemCache';

// RN 0.88 tipleri NativeMethods dışa aktarmıyor (bkz. PeriodPicker)
const SegmentedControl = NativeSegmentedControl as unknown as ComponentType<SegmentedControlProps>;

const YONLER: Yon[] = ['gelen', 'giden'];
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];


/** "49/49 ✓", "48/49 ⚠", sayı yoksa "49" */
function kontrolMetni(k: Kontrol | undefined, liste: number): string {
  if (!k || k.qnb === null) return `${liste}`;
  const tamam = k.liste + (k.taslak ?? 0) >= k.qnb;
  return `${k.liste}/${k.qnb - (k.taslak ?? 0)} ${tamam ? '✓' : '⚠'}`;
}

/** Kontrol tamam mı (taslaklar QNB sayısına dahil, listede yok) */
const kontrolTamam = (k: Kontrol) => k.qnb === null || k.liste + (k.taslak ?? 0) >= k.qnb;

type DenetimSatiri = { label: string; gelen?: string; giden?: string; sorun: boolean };


function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Dönemin KDV'si (TRY); iade faturaları ayrı. Hiçbir faturada KDV bilgisi yoksa satis null */
function kdvToplami(list: EFatura[]) {
  const gecerli = list.filter((f) => !f.iptal && !f.taslak && f.paraBirimi === 'TRY');
  const bilinen = gecerli.filter((f) => typeof f.kdv === 'number');
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const iadeler = bilinen.filter((f) => f.tip === 'IADE');
  const satislar = bilinen.filter((f) => f.tip !== 'IADE');
  return {
    satis: bilinen.length ? r2(satislar.reduce((t, f) => t + (f.kdv ?? 0), 0)) : null,
    matrah: r2(satislar.reduce((t, f) => t + (f.matrah ?? 0), 0)),
    iade: r2(iadeler.reduce((t, f) => t + (f.kdv ?? 0), 0)),
    iadeAdet: iadeler.length,
    eksik: gecerli.length - bilinen.length,
  };
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
  /** Genel Özet'te toplamlardan çıkarılan faturalar (olağan dışı yüksek tutar) */
  const [haric, setHaric] = useState<ReadonlySet<string>>(new Set());
  /** Listenin sıralaması (telefonda hatırlanır) */
  const [siralama, setSiralama] = useState<EFaturaSort>('yeni');
  useEffect(() => {
    AsyncStorage.getItem(EFATURA_SORT_KEY)
      .then((v) => {
        if (isEFaturaSort(v)) setSiralama(v);
      })
      .catch(() => {});
  }, []);
  const siralamaSec = () =>
    showActionSheet({
      title: 'Sırala',
      options: EFATURA_SORTS.map((o) => ({
        label: o.key === siralama ? `✓ ${o.label}` : o.label,
        onPress: () => {
          haptics.select();
          setSiralama(o.key);
          AsyncStorage.setItem(EFATURA_SORT_KEY, o.key).catch(() => {});
        },
      })),
    });
  // Özet ekranından dönünce güncel olsun
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(HARIC_KEY)
        .then((raw) => setHaric(new Set(raw ? (JSON.parse(raw) as string[]) : [])))
        .catch(() => {});
    }, []),
  );
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
    (qnbDurum.loginFailed && !items ? { message: 'QNB girişi daha önce başarısız oldu. Bilgileri kontrol ettikten sonra elle tekrar deneyin.', login: true } : undefined);

  const fetchList = useCallback(async (k: string, y: Yon, from: string, to: string, force = false) => {
    if (inflight.current.has(k)) return;
    inflight.current.add(k);
    setBusy(k);
    try {
      const list: Donem = await donemGetir(y, from, to, force);
      qnbDurum.loginFailed = false;
      cache.set(k, list);
      setData((d) => ({ ...d, [k]: list }));
      setErrors(({ [k]: _, ...rest }) => rest);
    } catch (e) {
      const login = e instanceof EFaturaError && e.loginFailed;
      if (login) qnbDurum.loginFailed = true;
      setErrors((cur) => ({ ...cur, [k]: { message: errorMessage(e), login } }));
    } finally {
      inflight.current.delete(k);
      setBusy((b) => (b === k ? null : b));
    }
  }, []);

  // Dönem ilk kez açılınca getir (önbellekte varsa ya da QNB girişi başarısızsa sorma)
  useEffect(() => {
    if (!items && !errors[key] && !qnbDurum.loginFailed) void fetchList(key, yon, range.from, range.to);
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
          const d: Donem = await donemGetir(y, r.from, r.to, true);
          cache.set(k, d);
          setData((cur) => ({ ...cur, [k]: d }));
          const metin = kontrolMetni(d.kontrol, d.faturalar.filter((f) => f.tur !== 'earsiv').length);
          satir[y] = metin;
          if (d.kontrol && !kontrolTamam(d.kontrol)) satir.sorun = true;
        } catch (e) {
          satir[y] = 'hata';
          satir.sorun = true;
          if (e instanceof EFaturaError && e.loginFailed) {
            qnbDurum.loginFailed = true;
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
  const refresh = () => fetchList(key, yon, range.from, range.to, true);
  const loading = !items && !error;

  const denetimSorun = denetim?.filter((d) => d.sorun).length ?? 0;
  const denetimSuruyor = !!denetimDurum && !denetimDurum.startsWith('Durduruldu');
  // İptal edilen e-Arşiv faturaları toplama girmez
  const hesaba = (f: EFatura) => !f.iptal && !haric.has(f.ettn.toLowerCase());
  const totals = items ? totalsByCurrency(items.filter(hesaba)) : [];
  const kdv = kdvToplami((items ?? []).filter(hesaba));
  const haricSayisi = (items ?? []).filter((f) => haric.has(f.ettn.toLowerCase())).length;
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
            <ListRow
              title="Fatura Sayısı"
              subtitle={haricSayisi ? `${haricSayisi} olağan dışı fatura toplamlara katılmadı (Genel Özet'ten değiştirilebilir)` : undefined}
              value={String(items.length)}
            />
            {data[key]?.kontrol?.qnb != null ? (
              <ListRow
                title="QNB Kontrolü"
                subtitle={`Listedeki / QNB'nin saydığı e-Fatura${data[key]?.kontrol?.taslak ? ` · ${data[key]!.kontrol!.taslak} gönderilmemiş taslak gizli` : ''}`}
                value={kontrolMetni(data[key]?.kontrol, items.length)}
                valueColor={kontrolTamam(data[key]!.kontrol!) ? theme.green : theme.orange}
              />
            ) : null}
            {totals.map((x) => (
              <ListRow key={x.paraBirimi} title={totals.length > 1 ? `Toplam (${x.paraBirimi})` : 'Toplam'} value={money(x.toplam, x.paraBirimi)} valueColor={theme.label} />
            ))}
            {kdv.satis !== null ? (
              <ListRow
                title={yon === 'gelen' ? 'KDV (indirilecek)' : 'KDV (hesaplanan)'}
                subtitle={kdv.matrah ? `Matrah ${money(kdv.matrah, 'TRY')}${kdv.eksik ? ` · ${kdv.eksik} faturada KDV bilgisi yok` : ''}` : undefined}
                value={money(kdv.satis, 'TRY')}
                valueColor={theme.label}
              />
            ) : null}
            {kdv.iade ? (
              <ListRow title="KDV (iade faturaları)" subtitle={`${kdv.iadeAdet} iade faturası · indirilecek KDV'den düşülür`} value={money(kdv.iade, 'TRY')} />
            ) : null}
          </ListSection>
          <ListSection
            header={yon === 'gelen' ? 'Gelen faturalar' : 'Giden faturalar'}
            headerAction={{ label: EFATURA_SORTS.find((o) => o.key === siralama)!.label, onPress: siralamaSec, accessibilityLabel: 'Sıralamayı değiştir' }}
            footer={
              yon === 'gelen'
                ? 'QNB eSolutions’tan fatura tarihine göre listelenir. Tutar, faturadaki ödenecek tutardır.'
                : 'e-Fatura (gönderim tarihine göre) ve e-Arşiv faturaları birlikte listelenir. İptal edilenler toplama girmez.'
            }>
            {sortEFaturalar(items, siralama).map((f) => (
              <ListRow
                key={f.ettn || f.belgeNo}
                icon={{ sf: yon === 'gelen' ? 'tray.and.arrow.down.fill' : 'paperplane.fill', ion: yon === 'gelen' ? 'download' : 'send', color: f.iptal ? theme.gray : yon === 'gelen' ? theme.blue : theme.green }}
                title={f.unvan}
                subtitle={[
                  dayMonth(f.tarih),
                  f.belgeNo,
                  f.tip === 'IADE' ? 'İade' : '',
                  f.tur === 'earsiv' ? 'e-Arşiv' : '',
                  f.iptal ? 'İptal' : '',
                  haric.has(f.ettn.toLowerCase()) ? 'Toplama dahil değil' : '',
                  typeof f.kdv === 'number' ? `KDV ${money(f.kdv, f.paraBirimi)}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
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
