import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';

import { ListRow, ListSection } from '../components/ui/List';
import { Badge } from '../components/web/Badge';
import { WebButton } from '../components/web/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/web/Card';
import { WebPageHeader } from '../components/web/PageHeader';
import { StatCard } from '../components/web/StatCard';
import { WebSwitch } from '../components/web/Switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/web/Table';
import { aylarArasi, ayAraligi, type DonemOzet, HARIC_KEY, indirilecekKdv, kdvFarki, OLAGANDISI_DAHIL_KEY, olaganDisi, ozetle } from '../lib/efaturaOzet';
import { errorMessage } from '../lib/errors';
import { capitalizeTr } from '../lib/format';
import { useWide } from '../lib/layout';
import { fontFamily, tabular, useShadcnTheme, useTheme } from '../lib/theme';
import { type EFatura, EFaturaError, getIlkAy, getOzetGelen, getOzetGiden, type TutarSatiri } from '../services/efatura/qnbEfatura';
import { supabase } from '../services/supabase/client';

const CACHE_KEY = 'efatura-ozet:v1';
/** Bu kadar aydan eski gelen dönemler telefonda saklanır, yeniden sorulmaz */
const SABIT_AY = 2;

type Onbellek = { ilkAy?: string | null; gelen: Record<string, { rows: TutarSatiri[]; qnb: number | null }> };

const invoke = (name: string, options: { body: Record<string, unknown> }) => supabase.functions.invoke(name, options);

function money(value: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function ayAdi(ay: string): string {
  const [y, m] = ay.split('-').map(Number);
  return m ? `${AYLAR[m - 1]} ${y}` : ay;
}

function trDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : '—';
}

async function onbellekOku(): Promise<Onbellek> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Onbellek) : { gelen: {} };
  } catch {
    return { gelen: {} };
  }
}

async function onbellekYaz(c: Onbellek) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // saklanamazsa bir dahaki açılışta yeniden sorulur
  }
}

/** e-Fatura genel özeti: ilk belgeden bugüne gelen/giden sayıları, matrah ve KDV. */
export default function EFaturaOzetScreen() {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
  const [ilk, setIlk] = useState<string | null | undefined>(undefined);
  const [gelen, setGelen] = useState<Onbellek['gelen']>({});
  const [giden, setGiden] = useState<{ giden: TutarSatiri[]; earsiv: EFatura[]; qnb: number | null; taslak: number } | null>(null);
  const [durum, setDurum] = useState<string | null>('Hazırlanıyor…');
  const [hata, setHata] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const calisiyor = useRef(false);
  /** Olağan dışı yüksek tutarlı faturalar toplamlara katılsın mı (varsayılan: hayır) */
  const [olaganDisiDahil, setOlaganDisiDahil] = useState(false);

  /** yenile: true ise saklanan aylar da yeniden sorulur */
  const yukle = useCallback(async (yenile: boolean) => {
    if (calisiyor.current) return;
    calisiyor.current = true;
    try {
      const c = await onbellekOku();
      setHata(null);
      try {
        setOlaganDisiDahil((await AsyncStorage.getItem(OLAGANDISI_DAHIL_KEY)) === '1');
      } catch {
        // tercih okunamazsa varsayılan: hariç
      }
      setGelen(c.gelen);
      let ilkAy = c.ilkAy;
      if (ilkAy === undefined || yenile) {
        setDurum('İlk fatura ayı bulunuyor…');
        ilkAy = await getIlkAy(invoke);
        c.ilkAy = ilkAy;
        await onbellekYaz(c);
      }
      setIlk(ilkAy);
      if (!ilkAy) return;

      const aylar = aylarArasi(ilkAy);
      const sabitSinir = aylar[Math.max(0, aylar.length - SABIT_AY)]!;
      setDurum('Giden faturalar alınıyor…');
      const { from } = ayAraligi(ilkAy);
      const bugun = new Date().toISOString().slice(0, 10);
      setGiden(await getOzetGiden(invoke, from, bugun));

      for (const [i, ay] of aylar.entries()) {
        if (!yenile && c.gelen[ay] && ay < sabitSinir) continue;
        setDurum(`Gelen faturalar: ${ayAdi(ay)} (${i + 1}/${aylar.length})`);
        const r = ayAraligi(ay);
        const sonuc = await getOzetGelen(invoke, r.from, r.to);
        c.gelen[ay] = { rows: sonuc.gelen, qnb: sonuc.qnb };
        setGelen({ ...c.gelen });
        await onbellekYaz(c);
      }
    } catch (e) {
      setHata(e instanceof EFaturaError && e.loginFailed ? `QNB girişi başarısız: ${errorMessage(e)}` : errorMessage(e));
    } finally {
      setDurum(null);
      calisiyor.current = false;
    }
  }, []);

  // Açılışta QNB'den (ve telefondaki önbellekten) özet verisi yüklenir
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void yukle(false);
  }, [yukle]);

  const aylar = ilk ? aylarArasi(ilk) : [];
  const gelenRows = aylar.flatMap((a) => gelen[a]?.rows ?? []);
  const gelenQnb = aylar.reduce((t, a) => t + (gelen[a]?.qnb ?? 0), 0);
  const gelenEksikAy = aylar.filter((a) => !gelen[a]).length;
  const tuhaf = olaganDisi(giden?.giden ?? []);
  const haric = new Set(olaganDisiDahil ? [] : tuhaf.map((t) => t.ettn.toLowerCase()));
  const oz = ozetle(gelenRows, giden?.giden ?? [], giden?.earsiv ?? [], haric);
  const g = oz.genel;
  const fark = kdvFarki(g);
  const haricKey = [...haric].sort().join(',');

  // Hariç tutulan faturalar aylık listede de toplamlara katılmasın diye saklanır
  useEffect(() => {
    if (!giden) return;
    AsyncStorage.setItem(HARIC_KEY, JSON.stringify(haricKey ? haricKey.split(',') : [])).catch(() => {});
  }, [giden, haricKey]);

  const dahilDegistir = (v: boolean) => {
    setOlaganDisiDahil(v);
    AsyncStorage.setItem(OLAGANDISI_DAHIL_KEY, v ? '1' : '0').catch(() => {});
  };
  const gidenListe = (giden?.giden.length ?? 0) + (giden?.taslak ?? 0);

  const satirAlt = (d: DonemOzet) =>
    `Gelen ${d.gelen.adet} · KDV ${money(d.gelen.kdv)}  |  Giden ${d.satis.adet + d.iade.adet + d.earsiv.adet} · KDV ${money(d.satis.kdv + d.earsiv.kdv)}`;

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 1100, width: '100%', gap: 24 }}>
            <WebPageHeader
              title="e-Fatura Genel Özeti"
              description={`${ilk ? ayAdi(ilk) : ''} tarihinden bugüne gelen/giden belge dağılımı ve KDV hesaplamaları.`}
              onBack={() => router.back()}
              actions={
                <WebButton
                  variant="outline"
                  icon={{ sf: 'arrow.clockwise', ion: 'reload' }}
                  disabled={!!durum}
                  onPress={() => yukle(true)}>
                  Tümünü QNB&apos;den Yeniden Al
                </WebButton>
              }
            />

            {hata && (
              <Card style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#991b1b' }}>Özet Hazırlanamadı</CardTitle>
                  <CardDescription style={{ color: '#b91c1c' }}>{hata}</CardDescription>
                </CardHeader>
                <CardContent>
                  <WebButton variant="outline" onPress={() => yukle(false)}>
                    Tekrar Dene
                  </WebButton>
                </CardContent>
              </Card>
            )}

            {durum && (
              <Card style={{ backgroundColor: st.muted, borderColor: st.border }}>
                <CardContent style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                  <ActivityIndicator size="small" />
                  <Text style={{ fontFamily, fontSize: 13, color: st.cardForeground }}>{durum}</Text>
                </CardContent>
              </Card>
            )}

            {ilk && (
              <>
                <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                  <StatCard
                    title="Gelen e-Fatura"
                    value={String(g.gelen.adet)}
                    description={`KDV: ${money(g.gelen.kdv)}`}
                    icon={{ sf: 'arrow.down.doc.fill', ion: 'arrow-down' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <StatCard
                    title="Giden Satış & e-Arşiv"
                    value={String(g.satis.adet + g.earsiv.adet)}
                    description={`KDV: ${money(g.satis.kdv + g.earsiv.kdv)}`}
                    icon={{ sf: 'arrow.up.doc.fill', ion: 'arrow-up' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <StatCard
                    title="İndirilecek KDV"
                    value={money(indirilecekKdv(g))}
                    description="Gelen faturalar ve iade düşümü"
                    icon={{ sf: 'minus.circle.fill', ion: 'remove-circle' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <StatCard
                    title="KDV Farkı"
                    value={money(fark)}
                    description={fark > 0 ? 'Ödenecek KDV dengesi' : 'Devreden KDV dengesi'}
                    icon={{ sf: 'percent', ion: 'calculator' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1.3, gap: 20 }}>
                    <Card>
                      <CardHeader>
                        <CardTitle>KDV Dengesi ({ayAdi(ilk)} – Bugün)</CardTitle>
                        <CardDescription>
                          Hesaplanan KDV giden satış/e-arşiv faturalarından, indirilecek KDV gelen e-faturalardan toplanır.
                        </CardDescription>
                      </CardHeader>
                      <CardContent style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>Hesaplanan KDV (Matrah {money(g.satis.matrah + g.earsiv.matrah)})</Text>
                          <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{money(g.satis.kdv + g.earsiv.kdv)}</Text>
                        </View>
                        {!!g.satis.tevkifat && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>Tevkifat (Alıcının ödediği)</Text>
                            <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{money(g.satis.tevkifat)}</Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>Gelen Faturalardaki KDV (Matrah {money(g.gelen.matrah)})</Text>
                          <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{money(g.gelen.kdv)}</Text>
                        </View>
                        {!!g.iade.adet && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>İade Edilen Alışlar ({g.iade.adet} fatura)</Text>
                            <Text style={[{ fontFamily, fontSize: 13, color: '#dc2626' }, tabular]}>−{money(g.iade.kdv)}</Text>
                          </View>
                        )}
                        <View style={{ height: 1, backgroundColor: st.border, marginVertical: 4 }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily, fontSize: 15, fontWeight: '700', color: st.cardForeground }}>Net KDV Farkı</Text>
                          <Text style={[{ fontFamily, fontSize: 18, fontWeight: '700', color: fark > 0 ? '#dc2626' : '#16a34a' }, tabular]}>
                            {money(fark)}
                          </Text>
                        </View>
                      </CardContent>
                    </Card>

                    {Object.keys(g.gelen.oranlar).length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>İndirilecek KDV, Oranlara Göre</CardTitle>
                          <CardDescription>Gelen faturaların KDV oranı kırılımı.</CardDescription>
                        </CardHeader>
                        <CardContent style={{ gap: 8 }}>
                          {Object.entries(g.gelen.oranlar)
                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                            .map(([o, v]) => (
                              <View key={o} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>%{o} KDV</Text>
                                <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{money(v)}</Text>
                              </View>
                            ))}
                        </CardContent>
                      </Card>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: 20 }}>
                    <Card>
                      <CardHeader>
                        <CardTitle>QNB Denetimi</CardTitle>
                        <CardDescription>
                          Uygulama listesindeki fatura sayısı QNB sunucu sayımıyla teyit edilir.
                        </CardDescription>
                      </CardHeader>
                      <CardContent style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily, fontSize: 13, color: st.cardForeground }}>Gelen Faturalar</Text>
                          <Badge variant={gelenRows.length >= gelenQnb ? 'secondary' : 'outline'}>
                            {gelenRows.length} / {gelenQnb} {gelenRows.length >= gelenQnb ? '✓' : '⚠'}
                          </Badge>
                        </View>
                        {giden?.qnb != null && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontFamily, fontSize: 13, color: st.cardForeground }}>Giden Faturalar</Text>
                            <Badge variant={gidenListe >= giden.qnb ? 'secondary' : 'outline'}>
                              {giden.giden.length} / {giden.qnb - giden.taslak} {gidenListe >= giden.qnb ? '✓' : '⚠'}
                            </Badge>
                          </View>
                        )}
                      </CardContent>
                    </Card>

                    {tuhaf.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Olağan Dışı Faturalar ({tuhaf.length})</CardTitle>
                          <CardDescription>
                            Ortalamanın çok üzerinde yüksek tutarlı faturalar.
                          </CardDescription>
                        </CardHeader>
                        <CardContent style={{ gap: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontFamily, fontSize: 13, color: st.cardForeground }}>Toplamlara Dahil Et</Text>
                            <WebSwitch checked={olaganDisiDahil} onCheckedChange={dahilDegistir} accessibilityLabel="Olağan dışı faturaları toplamlara dahil et" />
                          </View>
                          {tuhaf.map((t) => (
                            <View key={`${t.tarih}${t.belgeNo}`} style={{ padding: 10, borderRadius: 6, backgroundColor: st.muted, gap: 2 }}>
                              <Text style={{ fontFamily, fontSize: 13, fontWeight: '600', color: st.cardForeground }}>
                                {trDate(t.tarih)} · {t.belgeNo}
                              </Text>
                              <Text style={{ fontFamily, fontSize: 12, color: st.mutedForeground }}>
                                Matrah: {money(t.matrah)} · KDV: {money(t.kdv)} {olaganDisiDahil ? '' : '· Hariç'}
                              </Text>
                            </View>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </View>
                </View>

                <Card>
                  <CardHeader>
                    <CardTitle>Aylara Göre KDV Dökümü</CardTitle>
                    <CardDescription>Geçmiş tüm ayların gelen/giden adet ve net KDV dengesi.</CardDescription>
                  </CardHeader>
                  <CardContent style={{ padding: 0 }}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead style={{ flex: 1.5 }}>Dönem</TableHead>
                          <TableHead style={{ flex: 1.2 }}>Gelen Fatura</TableHead>
                          <TableHead style={{ flex: 1.4 }} align="right">Gelen KDV</TableHead>
                          <TableHead style={{ flex: 1.2 }}>Giden Fatura</TableHead>
                          <TableHead style={{ flex: 1.4 }} align="right">Giden KDV</TableHead>
                          <TableHead style={{ flex: 1.6 }} align="right">KDV Farkı</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {oz.aylar.map((d) => {
                          const kdvF = kdvFarki(d);
                          return (
                            <TableRow key={d.donem}>
                              <TableCell style={{ flex: 1.5 }}>
                                <Text style={{ fontFamily, fontSize: 13, fontWeight: '600', color: st.cardForeground }}>
                                  {capitalizeTr(ayAdi(d.donem))}
                                </Text>
                              </TableCell>
                              <TableCell style={{ flex: 1.2 }}>
                                <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                  {d.gelen.adet} adet
                                </Text>
                              </TableCell>
                              <TableCell style={{ flex: 1.4, alignItems: 'flex-end' }}>
                                <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                  {money(d.gelen.kdv)}
                                </Text>
                              </TableCell>
                              <TableCell style={{ flex: 1.2 }}>
                                <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                  {d.satis.adet + d.iade.adet + d.earsiv.adet} adet
                                </Text>
                              </TableCell>
                              <TableCell style={{ flex: 1.4, alignItems: 'flex-end' }}>
                                <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                  {money(d.satis.kdv + d.earsiv.kdv)}
                                </Text>
                              </TableCell>
                              <TableCell style={{ flex: 1.6, alignItems: 'flex-end' }}>
                                <Text style={[{ fontFamily, fontSize: 13, fontWeight: '700', color: kdvF > 0 ? '#dc2626' : '#16a34a' }, tabular]}>
                                  {money(kdvF)}
                                </Text>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

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
            await yukle(false);
            setPulling(false);
          }}
        />
      }>
      {hata ? (
        <ListSection footer={hata}>
          <ListRow title="Özet hazırlanamadı" subtitle="Tekrar denemek için dokunun" tone="action" onPress={() => yukle(false)} />
        </ListSection>
      ) : null}

      {durum ? (
        <ListSection footer="İlk açılışta her ay QNB'den tek tek alınır; geçmiş aylar telefonda saklanır, sonraki açılışlar hızlıdır.">
          <ListRow title={durum} accessory={<ActivityIndicator />} />
        </ListSection>
      ) : null}

      {ilk === null && !durum ? (
        <ListSection>
          <ListRow title="QNB'de fatura bulunamadı" />
        </ListSection>
      ) : null}

      {ilk ? (
        <>
          <ListSection header={`${ayAdi(ilk)} – bugün`}>
            <ListRow title="Gelen e-Fatura" value={String(g.gelen.adet)} valueColor={theme.label} />
            <ListRow title="Giden satış faturası" value={String(g.satis.adet)} valueColor={theme.label} />
            {g.iade.adet ? <ListRow title="Giden iade faturası" value={String(g.iade.adet)} valueColor={theme.label} /> : null}
            {g.earsiv.adet ? <ListRow title="Giden e-Arşiv" value={String(g.earsiv.adet)} valueColor={theme.label} /> : null}
          </ListSection>

          <ListSection
            header="KDV"
            footer="Hesaplanan KDV giden satış (ve e-Arşiv) faturalarından, indirilecek KDV gelen e-Faturalardan toplanır. Kestiğim iade faturalarının KDV'si (iade ettiğim alışlar) indirilecek KDV'den düşülür. Bilgi amaçlıdır, beyanname için muhasebecinize danışın.">
            <ListRow title="Hesaplanan KDV" subtitle={`Matrah ${money(g.satis.matrah + g.earsiv.matrah)}`} value={money(g.satis.kdv + g.earsiv.kdv)} valueColor={theme.label} />
            {g.satis.tevkifat ? <ListRow title="Tevkifat (alıcının ödediği)" value={money(g.satis.tevkifat)} /> : null}
            <ListRow title="Gelen e-Faturalardaki KDV" subtitle={`Matrah ${money(g.gelen.matrah)}`} value={money(g.gelen.kdv)} valueColor={theme.label} />
            {g.iade.adet ? <ListRow title="İade ettiğim alışlar" subtitle={`${g.iade.adet} iade faturası`} value={`−${money(g.iade.kdv)}`} /> : null}
            {g.iade.adet ? <ListRow title="İndirilecek KDV" value={money(indirilecekKdv(g))} valueColor={theme.label} /> : null}
            <ListRow title="Fark (hesaplanan − indirilecek)" value={money(fark)} valueColor={fark > 0 ? theme.red : theme.green} />
          </ListSection>

          {Object.keys(g.gelen.oranlar).length ? (
            <ListSection header="İndirilecek KDV, oranlara göre">
              {Object.entries(g.gelen.oranlar)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([o, v]) => (
                  <ListRow key={o} title={`%${o}`} value={money(v)} />
                ))}
            </ListSection>
          ) : null}

          {tuhaf.length ? (
            <ListSection
              header="Olağan dışı yüksek tutar"
              footer={
                olaganDisiDahil
                  ? 'Bu faturalar toplamlara dahil. Matrahları diğer giden faturaların ortancasından çok yüksek; yanlış tutarla kesilmiş olabilir.'
                  : 'Bu faturalar toplamlara ve aylık listedeki KDV toplamına katılmıyor (matrahları diğer giden faturaların ortancasından çok yüksek). QNB’de geçerli göründükleri için muhasebecinize bildirmeniz önerilir.'
              }>
              <ListRow
                title="Toplamlara Dahil Et"
                accessory={<Switch value={olaganDisiDahil} onValueChange={dahilDegistir} accessibilityLabel="Olağan dışı faturaları toplamlara dahil et" />}
              />
              {tuhaf.map((t) => (
                <ListRow
                  key={`${t.tarih}${t.belgeNo}`}
                  icon={{ sf: 'exclamationmark.triangle.fill', ion: 'warning', color: theme.orange }}
                  title={`${trDate(t.tarih)} · ${t.belgeNo}`}
                  subtitle={`Matrah ${money(t.matrah)} (ortancanın ~${t.kat} katı)${olaganDisiDahil ? '' : ' · hariç'}`}
                  value={money(t.kdv)}
                />
              ))}
            </ListSection>
          ) : null}

          <ListSection
            header="QNB kontrolü"
            footer={gelenEksikAy ? `${gelenEksikAy} ayın gelen bilgisi henüz alınmadı.` : 'Toplamlardaki fatura sayısı QNB’nin kendi sayımıyla karşılaştırılır (gönderilmemiş taslaklar hariç).'}>
            <ListRow
              title="Gelen"
              value={`${gelenRows.length}/${gelenQnb} ${gelenRows.length >= gelenQnb ? '✓' : '⚠'}`}
              valueColor={gelenRows.length >= gelenQnb ? theme.green : theme.orange}
            />
            {giden?.qnb != null ? (
              <ListRow
                title="Giden"
                subtitle={giden.taslak ? `${giden.taslak} gönderilmemiş taslak hariç` : undefined}
                value={`${giden.giden.length}/${giden.qnb - giden.taslak} ${gidenListe >= giden.qnb ? '✓' : '⚠'}`}
                valueColor={gidenListe >= giden.qnb ? theme.green : theme.orange}
              />
            ) : null}
          </ListSection>

          <ListSection header="Yıllar">
            {oz.yillar.map((d) => (
              <ListRow key={d.donem} title={d.donem} subtitle={satirAlt(d)} value={money(kdvFarki(d))} valueColor={kdvFarki(d) > 0 ? theme.red : theme.green} />
            ))}
          </ListSection>

          <ListSection header="Aylar" footer="Sağdaki tutar: hesaplanan − indirilecek KDV.">
            {oz.aylar.map((d) => (
              <ListRow
                key={d.donem}
                title={capitalizeTr(ayAdi(d.donem))}
                subtitle={satirAlt(d)}
                value={money(kdvFarki(d))}
                valueColor={kdvFarki(d) > 0 ? theme.red : theme.green}
              />
            ))}
          </ListSection>

          <ListSection>
            <ListRow title="Tümünü QNB'den Yeniden Al" tone="action" disabled={!!durum} onPress={() => yukle(true)} />
          </ListSection>
        </>
      ) : null}
    </ScrollView>
  );
}
