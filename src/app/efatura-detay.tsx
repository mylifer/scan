import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ListRow, ListSection } from '../components/ui/List';
import { Badge } from '../components/web/Badge';
import { WebButton } from '../components/web/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/web/Card';
import { WebPageHeader } from '../components/web/PageHeader';
import { StatCard } from '../components/web/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/web/Table';
import { errorMessage } from '../lib/errors';
import { useWide } from '../lib/layout';
import { fontFamily, tabular, useShadcnTheme, useTheme } from '../lib/theme';
import { showAlert } from '../lib/alert';
import { fetchInvoicePdf } from '../services/efatura/pdfCache';
import { EFaturaError, type FaturaDetay, getEFaturaDetay, type Tur, type Yon } from '../services/efatura/qnbEfatura';
import { sharePdf } from '../services/export/exportReceipts';
import { supabase } from '../services/supabase/client';

/** Aynı fatura yeniden açılınca QNB'ye tekrar sorulmasın */
const cache = new Map<string, FaturaDetay>();

/** UBL birim kodları (en yaygınları) */
const BIRIM: Record<string, string> = {
  C62: 'adet',
  H87: 'adet',
  NIU: 'adet',
  KGM: 'kg',
  GRM: 'g',
  LTR: 'lt',
  MTR: 'm',
  MTK: 'm²',
  KWH: 'kWh',
  SET: 'set',
  BX: 'kutu',
  PA: 'paket',
  HUR: 'saat',
  DAY: 'gün',
  MON: 'ay',
};

function money(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

const qty = (n: number) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(n);

function trDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : '—';
}

/** Bir e-Faturanın kalemleri, KDV dökümü ve toplamları (QNB'den UBL indirilir). */
export default function EFaturaDetayScreen() {
  const theme = useTheme();
  const wide = useWide();
  const st = useShadcnTheme();
  const params = useLocalSearchParams<{ yon?: string; ettn?: string; unvan?: string; tur?: string; belgeNo?: string }>();
  const yon: Yon = params.yon === 'giden' ? 'giden' : 'gelen';
  const tur: Tur = params.tur === 'earsiv' ? 'earsiv' : 'efatura';
  const ettn = params.ettn ?? '';
  const [detay, setDetay] = useState<FaturaDetay | null>(() => cache.get(ettn) ?? null);
  const [error, setError] = useState<{ message: string; login: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const d = await getEFaturaDetay((name, options) => supabase.functions.invoke(name, options), yon, ettn, tur);
      cache.set(ettn, d);
      setDetay(d);
      setError(null);
    } catch (e) {
      setError({ message: errorMessage(e), login: e instanceof EFaturaError && e.loginFailed });
    } finally {
      setBusy(false);
    }
  }, [yon, ettn, tur]);

  const [pdfBusy, setPdfBusy] = useState(false);
  const openPdf = async () => {
    setPdfBusy(true);
    try {
      const cached = await fetchInvoicePdf(yon, ettn, tur);
      const ad = (detay?.belgeNo || params.belgeNo || ettn).replace(/[^\w-]/g, '_');
      await sharePdf(cached.bytes, `${ad}.pdf`);
    } catch (e) {
      showAlert('PDF açılamadı', errorMessage(e));
    } finally {
      setPdfBusy(false);
    }
  };

  // İlk açılışta bir kez getir; hata olursa yalnızca elle tekrar denenir
  useEffect(() => {
    if (started.current || detay || !ettn) return;
    started.current = true;
    void load();
  }, [detay, ettn, load]);

  const cur = detay?.paraBirimi ?? 'TRY';
  const title = detay ? (yon === 'gelen' ? detay.saticiUnvan : detay.aliciUnvan) : (params.unvan ?? 'Fatura');

  if (wide) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 32, alignItems: 'center' }}>
          <View style={{ maxWidth: 1050, width: '100%', gap: 24 }}>
            <WebPageHeader
              title={title}
              description={`${detay?.belgeNo || params.belgeNo || 'Fatura'} · ${detay?.tarih ? trDate(detay.tarih) : ''} · ${yon === 'gelen' ? 'Gelen Fatura' : 'Giden Fatura'}`}
              onBack={() => router.back()}
              badge={
                <Badge variant={tur === 'earsiv' ? 'outline' : 'default'}>
                  {tur === 'earsiv' ? 'e-Arşiv' : 'e-Fatura'}
                </Badge>
              }
              actions={
                ettn ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <WebButton
                      variant="outline"
                      icon={{ sf: 'doc.richtext.fill', ion: 'document' }}
                      onPress={openPdf}
                      loading={pdfBusy}>
                      PDF İndir / Paylaş
                    </WebButton>
                  </View>
                ) : undefined
              }
            />

            {error && (
              <Card style={{ borderColor: '#ef4444', backgroundColor: '#fef2f2' }}>
                <CardHeader>
                  <CardTitle style={{ color: '#991b1b' }}>
                    {error.login ? 'QNB Girişi Başarısız' : 'Fatura Açılamadı'}
                  </CardTitle>
                  <CardDescription style={{ color: '#b91c1c' }}>{error.message}</CardDescription>
                </CardHeader>
                <CardContent>
                  <WebButton variant="outline" onPress={load} loading={busy}>
                    Tekrar Dene
                  </WebButton>
                </CardContent>
              </Card>
            )}

            {!detay && !error && <ActivityIndicator style={{ marginTop: 48 }} />}

            {detay && (
              <>
                <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                  <StatCard
                    title="Ödenecek Tutar"
                    value={money(detay.odenecek, cur)}
                    description="KDV dahil nihai fatura tutarı"
                    icon={{ sf: 'creditcard.fill', ion: 'card' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <StatCard
                    title="Ara Toplam"
                    value={money(detay.araToplam, cur)}
                    description="KDV hariç net matrah"
                    icon={{ sf: 'cart.fill', ion: 'cart' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <StatCard
                    title="Toplam KDV"
                    value={money(detay.kdvler.reduce((s, k) => s + k.tutar, 0), cur)}
                    description={`${detay.kdvler.length} KDV oranı`}
                    icon={{ sf: 'percent', ion: 'calculator' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <StatCard
                    title="Fatura No"
                    value={detay.belgeNo}
                    description={`Tarih: ${trDate(detay.tarih)}`}
                    icon={{ sf: 'doc.text.fill', ion: 'receipt' }}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                </View>

                <Card>
                  <CardHeader>
                    <CardTitle>Kalemler ({detay.kalemler.length})</CardTitle>
                    <CardDescription>Faturada yer alan mal ve hizmetlerin dökümü.</CardDescription>
                  </CardHeader>
                  <CardContent style={{ padding: 0 }}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead style={{ flex: 3 }}>Kalem Adı</TableHead>
                          <TableHead style={{ flex: 1.2 }}>Miktar</TableHead>
                          <TableHead style={{ flex: 1.5 }} align="right">Birim Fiyat</TableHead>
                          <TableHead style={{ flex: 1 }} align="right">KDV</TableHead>
                          <TableHead style={{ flex: 1.6 }} align="right">Tutar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detay.kalemler.map((k, i) => (
                          <TableRow key={i}>
                            <TableCell style={{ flex: 3 }}>
                              <Text style={{ fontFamily, fontSize: 13, fontWeight: '500', color: st.cardForeground }}>
                                {k.ad}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.2 }}>
                              <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                {qty(k.miktar)} {BIRIM[k.birim] ?? k.birim}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.5, alignItems: 'flex-end' }}>
                              <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                {money(k.birimFiyat, cur)}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1, alignItems: 'flex-end' }}>
                              <Text style={[{ fontFamily, fontSize: 13, color: st.mutedForeground }, tabular]}>
                                {k.kdvOrani ? `%${qty(k.kdvOrani)}` : '—'}
                              </Text>
                            </TableCell>
                            <TableCell style={{ flex: 1.6, alignItems: 'flex-end' }}>
                              <Text style={[{ fontFamily, fontSize: 13, fontWeight: '600', color: st.cardForeground }, tabular]}>
                                {money(k.tutar + k.kdvTutari, cur)}
                              </Text>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1.2, gap: 20 }}>
                    <Card>
                      <CardHeader>
                        <CardTitle>{yon === 'gelen' ? 'Satıcı Bilgileri' : 'Alıcı Bilgileri'}</CardTitle>
                        <CardDescription>Fatura tarafına ait kurumsal detaylar.</CardDescription>
                      </CardHeader>
                      <CardContent style={{ gap: 12 }}>
                        <View style={{ gap: 2 }}>
                          <Text style={{ fontFamily, fontSize: 12, color: st.mutedForeground }}>Ticari Unvan</Text>
                          <Text style={{ fontFamily, fontSize: 14, fontWeight: '600', color: st.cardForeground }}>{title}</Text>
                        </View>
                        <View style={{ gap: 2 }}>
                          <Text style={{ fontFamily, fontSize: 12, color: st.mutedForeground }}>VKN / TCKN</Text>
                          <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>
                            {(yon === 'gelen' ? detay.saticiVkn : detay.aliciVkn) || '—'}
                          </Text>
                        </View>
                        <View style={{ gap: 2 }}>
                          <Text style={{ fontFamily, fontSize: 12, color: st.mutedForeground }}>Fatura No & Tarih</Text>
                          <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>
                            {detay.belgeNo} · {trDate(detay.tarih)}
                          </Text>
                        </View>
                      </CardContent>
                    </Card>

                    {detay.notlar.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Fatura Notları</CardTitle>
                        </CardHeader>
                        <CardContent style={{ gap: 8 }}>
                          {detay.notlar.map((n, i) => (
                            <Text key={i} style={{ fontFamily, fontSize: 13, color: st.cardForeground, lineHeight: 18 }}>
                              {n}
                            </Text>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Card>
                      <CardHeader>
                        <CardTitle>Toplamlar Özeti</CardTitle>
                        <CardDescription>UBL belgesinden hesaplanan toplam tutar.</CardDescription>
                      </CardHeader>
                      <CardContent style={{ gap: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>Ara Toplam (KDV hariç)</Text>
                          <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{money(detay.araToplam, cur)}</Text>
                        </View>
                        {!!detay.iskonto && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>İskonto</Text>
                            <Text style={[{ fontFamily, fontSize: 13, color: '#dc2626' }, tabular]}>−{money(detay.iskonto, cur)}</Text>
                          </View>
                        )}
                        {detay.kdvler.map((v) => (
                          <View key={v.oran} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontFamily, fontSize: 13, color: st.mutedForeground }}>
                              KDV %{qty(v.oran)} (Matrah: {money(v.matrah, cur)})
                            </Text>
                            <Text style={[{ fontFamily, fontSize: 13, color: st.cardForeground }, tabular]}>{money(v.tutar, cur)}</Text>
                          </View>
                        ))}
                        <View style={{ height: 1, backgroundColor: st.border, marginVertical: 4 }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontFamily, fontSize: 15, fontWeight: '700', color: st.cardForeground }}>Ödenecek Tutar</Text>
                          <Text style={[{ fontFamily, fontSize: 18, fontWeight: '700', color: st.cardForeground }, tabular]}>
                            {money(detay.odenecek, cur)}
                          </Text>
                        </View>
                      </CardContent>
                    </Card>
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: 'Fatura' }} />

      {error && (
        <ListSection footer={error.login ? `${error.message}\n\nHesabınız kilitlenmesin diye otomatik olarak tekrar denenmez.` : error.message}>
          <ListRow
            title={error.login ? 'QNB girişi başarısız' : 'Fatura açılamadı'}
            subtitle={busy ? 'Deneniyor…' : 'Tekrar denemek için dokunun'}
            tone="action"
            disabled={busy}
            accessory={busy ? <ActivityIndicator /> : undefined}
            onPress={load}
          />
        </ListSection>
      )}

      {ettn ? (
        <ListSection>
          <ListRow
            title="PDF'i Aç"
            subtitle={pdfBusy ? 'İndiriliyor…' : 'Paylaş, Dosyalar’a kaydet ya da yazdır'}
            icon={{ sf: 'doc.richtext.fill', ion: 'document', color: theme.red }}
            tone="action"
            disabled={pdfBusy}
            accessory={pdfBusy ? <ActivityIndicator /> : undefined}
            onPress={openPdf}
          />
        </ListSection>
      ) : null}

      {!detay && !error ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}

      {detay && (
        <>
          <ListSection header={yon === 'gelen' ? 'Satıcı' : 'Alıcı'}>
            <ListRow title={title} subtitle={(yon === 'gelen' ? detay.saticiVkn : detay.aliciVkn) || undefined} />
            <ListRow title="Fatura No" value={detay.belgeNo} />
            <ListRow title="Tarih" value={trDate(detay.tarih)} />
          </ListSection>

          <ListSection header={`Kalemler (${detay.kalemler.length})`}>
            {detay.kalemler.map((k, i) => (
              <ListRow
                key={i}
                title={k.ad}
                subtitle={`${qty(k.miktar)} ${BIRIM[k.birim] ?? k.birim} × ${money(k.birimFiyat, cur)}${k.kdvOrani ? ` · KDV %${qty(k.kdvOrani)}` : ''}`}
                value={money(k.tutar + k.kdvTutari, cur)}
                valueColor={theme.label}
              />
            ))}
          </ListSection>

          <ListSection header="Toplamlar" footer="Kalem tutarları KDV dahildir. Değerler QNB eSolutions'taki faturanın (UBL) kendisinden okunur.">
            <ListRow title="Ara Toplam (KDV hariç)" value={money(detay.araToplam, cur)} />
            {detay.iskonto ? <ListRow title="İskonto" value={`−${money(detay.iskonto, cur)}`} /> : null}
            {detay.kdvler.map((v) => (
              <ListRow key={v.oran} title={`KDV %${qty(v.oran)}`} subtitle={`Matrah ${money(v.matrah, cur)}`} value={money(v.tutar, cur)} />
            ))}
            <ListRow title="Ödenecek Tutar" value={money(detay.odenecek, cur)} valueColor={theme.label} />
          </ListSection>

          {detay.notlar.length > 0 && (
            <ListSection header="Notlar">
              {detay.notlar.map((n, i) => (
                <ListRow key={i} title={n} />
              ))}
            </ListSection>
          )}
        </>
      )}
    </ScrollView>
  );
}
