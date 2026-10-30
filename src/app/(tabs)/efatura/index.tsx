import NativeSegmentedControl, { type SegmentedControlProps } from '@react-native-segmented-control/segmented-control';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EFaturaExportBar } from '../../../components/efatura/EFaturaExportBar';
import { EFaturaTable } from '../../../components/efatura/EFaturaTable';
import { PdfViewerModal } from '../../../components/efatura/PdfViewerModal';
import { StatTiles } from '../../../components/ui/Columns';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Icon } from '../../../components/ui/Icon';
import { ListRow, ListSection } from '../../../components/ui/List';
import { showActionSheet } from '../../../lib/actionSheet';
import { HARIC_KEY } from '../../../lib/efaturaOzet';
import { EFATURA_SORT_KEY, EFATURA_SORTS, type EFaturaSort, isEFaturaSort, sortEFaturalar } from '../../../lib/efaturaSort';
import { errorMessage } from '../../../lib/errors';
import { capitalizeTr, monthRange } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWide } from '../../../lib/layout';
import { fontFamily, type as t, useShadcnTheme, useTheme } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { Badge } from '../../../components/web/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/web/Card';
import { WebButton } from '../../../components/web/Button';
import { WebPageHeader } from '../../../components/web/PageHeader';
import { TabsList, TabsTrigger } from '../../../components/web/Tabs';
import { exportEFaturaExcel, exportEFaturaPdfs } from '../../../services/efatura/efaturaExport';
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
  const st = useShadcnTheme();
  const wide = useWide();
  const [yon, setYon] = useState<Yon>('gelen');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Record<string, Donem>>(() => Object.fromEntries(cache));
  const [errors, setErrors] = useState<Record<string, { message: string; login: boolean }>>({});
  const [pulling, setPulling] = useState(false);
  const [pdfModalFatura, setPdfModalFatura] = useState<EFatura | null>(null);
  const [selectedEttns, setSelectedEttns] = useState<ReadonlySet<string>>(new Set());
  const [exportingText, setExportingText] = useState<string | null>(null);

  // Dönem veya yön değişince seçimi sıfırla
  useEffect(() => {
    setSelectedEttns(new Set());
  }, [yon, offset]);

  const toggleSelect = useCallback((ettn: string) => {
    haptics.select();
    const k = ettn.toLowerCase();
    setSelectedEttns((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  }, []);
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
  const siralamaDegistir = (k: EFaturaSort) => {
    haptics.select();
    setSiralama(k);
    AsyncStorage.setItem(EFATURA_SORT_KEY, k).catch(() => {});
  };
  const siralamaSec = () =>
    showActionSheet({
      title: 'Sırala',
      options: EFATURA_SORTS.map((o) => ({
        label: o.key === siralama ? `✓ ${o.label}` : o.label,
        onPress: () => siralamaDegistir(o.key),
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

  const selectedList = useMemo(() => {
    return (items ?? []).filter((f) => !!f.ettn && selectedEttns.has(f.ettn.toLowerCase()));
  }, [items, selectedEttns]);

  const allSelected = useMemo(() => {
    const withEttn = (items ?? []).filter((f) => !!f.ettn);
    return withEttn.length > 0 && selectedList.length === withEttn.length;
  }, [items, selectedList]);

  const selectedTotalAmount = useMemo(() => {
    return selectedList.reduce((acc, f) => acc + (f.tutar ?? 0), 0);
  }, [selectedList]);

  const toggleSelectAll = useCallback(() => {
    haptics.select();
    const withEttn = (items ?? []).filter((f) => !!f.ettn);
    if (withEttn.every((f) => selectedEttns.has(f.ettn.toLowerCase()))) {
      setSelectedEttns(new Set());
    } else {
      setSelectedEttns(new Set(withEttn.map((f) => f.ettn.toLowerCase())));
    }
  }, [items, selectedEttns]);

  const handleExportExcel = async () => {
    if (selectedList.length === 0) return;
    try {
      haptics.select();
      await exportEFaturaExcel(selectedList, range.label, yon);
      haptics.success();
    } catch (e) {
      showToast(errorMessage(e));
    }
  };

  const handleExportPdf = async () => {
    if (selectedList.length === 0) return;
    try {
      haptics.select();
      setExportingText(selectedList.length > 1 ? `PDF'ler hazırlanıyor (0/${selectedList.length})…` : 'PDF getiriliyor…');
      const res = await exportEFaturaPdfs(selectedList, yon, range.label, (done, total) => {
        setExportingText(total > 1 ? `PDF'ler hazırlanıyor (${done}/${total})…` : 'PDF getiriliyor…');
      });
      haptics.success();
      if (res.failed > 0) {
        showToast(`${res.success} PDF indirildi, ${res.failed} fatura alınamadı.`);
      }
    } catch (e) {
      showToast(errorMessage(e));
    } finally {
      setExportingText(null);
    }
  };
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
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: wide ? 20 : 16,
          paddingHorizontal: wide ? 8 : 0,
          paddingBottom: selectedList.length > 0 ? 96 : 40,
        }}
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
      {wide ? (
        <View style={{ maxWidth: 1200, width: '100%', alignSelf: 'center', paddingHorizontal: 16 }}>
          <WebPageHeader
            title="e-Faturalar"
            description="QNB eSolutions entegrasyonu ile gelen ve giden e-Arşiv / e-Fatura listesi."
            actions={
              <WebButton
                variant="outline"
                icon={{ sf: 'arrow.clockwise', ion: 'reload' }}
                onPress={refresh}>
                Yenile
              </WebButton>
            }
          />
        </View>
      ) : null}
      <View style={[styles.controls, wide && styles.controlsWide]}>
        {wide ? (
          <TabsList>
            <TabsTrigger value="gelen" active={yon === 'gelen'} onPress={() => setYon('gelen')}>
              Gelen Faturalar
            </TabsTrigger>
            <TabsTrigger value="giden" active={yon === 'giden'} onPress={() => setYon('giden')}>
              Giden Faturalar
            </TabsTrigger>
          </TabsList>
        ) : (
          <View>
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
          </View>
        )}
        <View style={[styles.monthRow, wide && [styles.monthRowWide, { borderColor: st.border, backgroundColor: st.card }]]}>
          <MonthButton dir="left" label="Önceki ay" onPress={() => setOffset((o) => o - 1)} />
          <Text style={[wide ? styles.periodTextWide : t.headline, { color: wide ? st.cardForeground : theme.label }]}>
            {capitalizeTr(range.label)}
          </Text>
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
          {wide ? (
            <StatTiles
              items={[
                {
                  label: 'Fatura Sayısı',
                  value: String(items.length),
                  note:
                    data[key]?.kontrol?.qnb != null
                      ? `QNB kontrolü ${kontrolMetni(data[key]?.kontrol, items.length)}${haricSayisi ? ` · ${haricSayisi} olağan dışı toplama katılmadı` : ''}`
                      : undefined,
                  color: data[key]?.kontrol?.qnb != null && !kontrolTamam(data[key]!.kontrol!) ? theme.orange : undefined,
                },
                ...totals.map((x) => ({ label: totals.length > 1 ? `Toplam (${x.paraBirimi})` : 'Toplam', value: money(x.toplam, x.paraBirimi) })),
                ...(kdv.satis !== null
                  ? [
                      {
                        label: yon === 'gelen' ? 'KDV (indirilecek)' : 'KDV (hesaplanan)',
                        value: money(kdv.satis, 'TRY'),
                        note: kdv.matrah ? `Matrah ${money(kdv.matrah, 'TRY')}${kdv.eksik ? ` · ${kdv.eksik} faturada KDV yok` : ''}` : undefined,
                      },
                    ]
                  : []),
                ...(kdv.iade ? [{ label: 'İade KDV', value: money(kdv.iade, 'TRY'), note: `${kdv.iadeAdet} iade faturası · indirilecekten düşülür` }] : []),
              ]}
            />
          ) : (
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
          )}
          {wide ? (
            <>
              <EFaturaTable
                items={sortEFaturalar(items, siralama)}
                yon={yon}
                siralama={siralama}
                onSiralama={siralamaDegistir}
                haric={haric}
                onOpen={(f) => router.push({ pathname: '/efatura-detay', params: { yon, ettn: f.ettn, unvan: f.unvan, tur: f.tur ?? 'efatura', belgeNo: f.belgeNo } })}
                onViewPdf={(f) => setPdfModalFatura(f)}
                selected={selectedEttns}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
              />
              <Text style={[t.footnote, { color: theme.secondaryLabel, marginHorizontal: 32, marginTop: 7, marginBottom: 28 }]}>
                {yon === 'gelen'
                  ? 'QNB eSolutions’tan fatura tarihine göre listelenir. Tutar, faturadaki ödenecek tutardır. Sıralamak için sütun başlığına tıklayın.'
                  : 'e-Fatura (gönderim tarihine göre) ve e-Arşiv faturaları birlikte listelenir. İptal edilenler toplama girmez. Sıralamak için sütun başlığına tıklayın.'}
              </Text>
            </>
          ) : (
          <ListSection
              header={yon === 'gelen' ? 'Gelen faturalar' : 'Giden faturalar'}
              headerAction={
                selectedEttns.size > 0
                  ? { label: 'Seçimi Kaldır', onPress: () => setSelectedEttns(new Set()), accessibilityLabel: 'Seçimi kaldır' }
                  : { label: EFATURA_SORTS.find((o) => o.key === siralama)!.label, onPress: siralamaSec, accessibilityLabel: 'Sıralamayı değiştir' }
              }
              footer={
                yon === 'gelen'
                  ? 'QNB eSolutions’tan fatura tarihine göre listelenir. Tutar, faturadaki ödenecek tutardır. Çoklu seçim için satıra basılı tutun.'
                  : 'e-Fatura (gönderim tarihine göre) ve e-Arşiv faturaları birlikte listelenir. İptal edilenler toplama girmez. Çoklu seçim için satıra basılı tutun.'
              }>
              {sortEFaturalar(items, siralama).map((f) => (
                <ListRow
                  key={f.ettn || f.belgeNo}
                  icon={{
                    sf: yon === 'gelen' ? 'tray.and.arrow.down.fill' : 'paperplane.fill',
                    ion: yon === 'gelen' ? 'download' : 'send',
                    color: f.iptal ? theme.gray : yon === 'gelen' ? theme.blue : theme.green,
                  }}
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
                  accessory={
                    selectedEttns.size > 0 ? (
                      <View style={{ marginLeft: 6 }}>
                        <Icon
                          sf={selectedEttns.has(f.ettn.toLowerCase()) ? 'checkmark.circle.fill' : 'circle'}
                          ion={selectedEttns.has(f.ettn.toLowerCase()) ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={selectedEttns.has(f.ettn.toLowerCase()) ? theme.blue : theme.tertiaryLabel}
                        />
                      </View>
                    ) : f.ettn ? (
                      <Pressable
                        onPress={(e) => {
                          (e as unknown as { stopPropagation?: () => void })?.stopPropagation?.();
                          setPdfModalFatura(f);
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`${f.unvan} PDF görüntüle`}
                        style={({ pressed }) => [{ padding: 6, marginLeft: 6, borderRadius: 6, opacity: pressed ? 0.6 : 1 }]}>
                        <Icon sf="doc.text.fill" ion="document-text-outline" size={17} color={theme.blue} />
                      </Pressable>
                    ) : undefined
                  }
                  chevron={selectedEttns.size === 0 && !!f.ettn}
                  onLongPress={f.ettn ? () => toggleSelect(f.ettn) : undefined}
                  onPress={
                    selectedEttns.size > 0 && f.ettn
                      ? () => toggleSelect(f.ettn)
                      : f.ettn
                        ? () => router.push({ pathname: '/efatura-detay', params: { yon, ettn: f.ettn, unvan: f.unvan, tur: f.tur ?? 'efatura', belgeNo: f.belgeNo } })
                        : undefined
                  }
                />
              ))}
            </ListSection>
          )}
        </>
      ) : null}
      {wide ? (
        <Card style={{ marginHorizontal: 16, marginTop: 24, marginBottom: 20 }}>
          <CardHeader style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ gap: 2, flex: 1, minWidth: 260 }}>
              <CardTitle>QNB Senkronizasyon Denetimi</CardTitle>
              <CardDescription>
                {denetim && !denetimSuruyor && denetim.length
                  ? denetimSorun
                    ? `${denetimSorun} ayda QNB'nin saydığı e-Fatura listede tam görünmüyor (⚠).`
                    : 'Son 12 ayın tamamında listedeki e-Fatura sayısı QNB ile tam eşleşiyor.'
                  : 'Her ay için listedeki fatura sayısı ile QNB resmi sayımını karşılaştırır.'}
              </CardDescription>
            </View>
            <WebButton
              variant="outline"
              size="sm"
              icon={{ sf: 'checklist', ion: 'checkmark-done' }}
              onPress={denetle}
              loading={denetimSuruyor}
              disabled={denetimSuruyor}>
              {denetimDurum ? denetimDurum : 'Son 12 Ayı Denetle'}
            </WebButton>
          </CardHeader>
          {denetim && denetim.length > 0 && (
            <CardContent style={{ gap: 8 }}>
              {denetim.map((d) => (
                <View
                  key={d.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 8,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: st.border,
                  }}>
                  <Text style={{ fontSize: 13, fontWeight: '500', color: st.cardForeground }}>{d.label}</Text>
                  <Text style={{ fontSize: 12, color: st.mutedForeground }}>
                    Gelen {d.gelen ?? '…'} · Giden {d.giden ?? '…'}
                  </Text>
                  <Badge variant={d.sorun ? 'destructive' : 'success'}>
                    {d.sorun ? 'Uyuşmazlık (⚠)' : 'Tam Uyumlu (✓)'}
                  </Badge>
                </View>
              ))}
            </CardContent>
          )}
        </Card>
      ) : (
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
      )}
    </ScrollView>

    {/* Sabit Yüzen Toplu İşlem Çubuğu */}
    <EFaturaExportBar
      selectedCount={selectedList.length}
      totalCount={(items ?? []).filter((f) => !!f.ettn).length}
      totalAmount={selectedTotalAmount}
      currency={selectedList[0]?.paraBirimi ?? 'TRY'}
      allSelected={allSelected}
      onToggleSelectAll={toggleSelectAll}
      onClearSelection={() => setSelectedEttns(new Set())}
      onExportExcel={handleExportExcel}
      onExportPdf={handleExportPdf}
      exportingText={exportingText}
    />

    <PdfViewerModal
      visible={!!pdfModalFatura}
      fatura={pdfModalFatura}
      yon={yon}
      onClose={() => setPdfModalFatura(null)}
    />
  </View>
);
}

function MonthButton({ dir, label, onPress, disabled }: { dir: 'left' | 'right'; label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();
  return (
    <Pressable
      onPress={() => {
        haptics.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        {
          opacity: disabled ? 0.25 : pressed ? 0.5 : 1,
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        },
        hovered && wide && { backgroundColor: st.muted },
      ]}>
      <Icon sf={`chevron.${dir}`} ion={dir === 'left' ? 'chevron-back' : 'chevron-forward'} size={16} color={wide ? st.cardForeground : theme.blue} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { marginHorizontal: 16, marginBottom: 16, gap: 12 },
  controlsWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthRowWide: { width: 280, borderWidth: 1, borderRadius: 8, paddingHorizontal: 4 },
  periodTextWide: { fontFamily, fontSize: 13, fontWeight: '600' },
});
