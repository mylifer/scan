import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../../components/ui/Icon';
import { ListRow, ListSection } from '../../../components/ui/List';
import { HARIC_KEY } from '../../../lib/efaturaOzet';
import { errorMessage } from '../../../lib/errors';
import { capitalizeTr, formatTL, monthRange } from '../../../lib/format';
import { haptics } from '../../../lib/haptics';
import { useWide } from '../../../lib/layout';
import { type KdvAy, kdvAyHesapla } from '../../../lib/kdvAy';
import { fontFamily, tabular, type as t, useShadcnTheme, useTheme } from '../../../lib/theme';
import { Badge } from '../../../components/web/Badge';
import { donemGetir, qnbDurum } from '../../../services/efatura/donemCache';
import { EFaturaError } from '../../../services/efatura/qnbEfatura';
import { getSummary } from '../../../services/supabase/receiptsRepository';

/** Ayın ilk ve son günü (QNB'de bitiş dahil) ve fiş sorgusu için bir sonraki ayın ilk günü */
function ayAraligi(offset: number) {
  const r = monthRange(offset);
  const [y, m] = r.from.split('-').map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return { from: r.from, to: `${r.from.slice(0, 8)}${String(last).padStart(2, '0')}`, sonraki: r.to, label: r.label };
}

/**
 * Ay ay KDV: giden faturalarda kestiğim, gelen faturalardan (ve fişlerden) düşebileceğim ve ikisinin farkı.
 * Renkler anlam taşımaz; her rakamın ne olduğu yanında yazar.
 */
export default function KdvScreen() {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();
  const [offset, setOffset] = useState(0);
  const [sonuclar, setSonuclar] = useState<Record<string, KdvAy>>({});
  const [hatalar, setHatalar] = useState<Record<string, { message: string; login: boolean }>>({});
  const [yukleniyor, setYukleniyor] = useState<string | null>(null);
  const [haric, setHaric] = useState<ReadonlySet<string>>(new Set());

  const ay = ayAraligi(offset);
  const kdv = sonuclar[ay.from];
  const hata = hatalar[ay.from];

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(HARIC_KEY)
        .then((raw) => setHaric(new Set(raw ? (JSON.parse(raw) as string[]) : [])))
        .catch(() => {});
    }, []),
  );

  const yukle = useCallback(
    async (yenile: boolean) => {
      const a = ayAraligi(offset);
      if (qnbDurum.loginFailed && !yenile) {
        setHatalar((h) => ({ ...h, [a.from]: { message: 'QNB girişi daha önce başarısız oldu. Bilgileri kontrol edip elle tekrar deneyin.', login: true } }));
        return;
      }
      setYukleniyor(a.from);
      try {
        const [gelen, giden, fis] = await Promise.all([
          donemGetir('gelen', a.from, a.to, yenile),
          donemGetir('giden', a.from, a.to, yenile),
          getSummary({ from: a.from, to: a.sonraki }),
        ]);
        setSonuclar((s) => ({ ...s, [a.from]: kdvAyHesapla(gelen.faturalar, giden.faturalar, fis.fisler, haric) }));
        setHatalar(({ [a.from]: _, ...rest }) => rest);
      } catch (e) {
        setHatalar((h) => ({ ...h, [a.from]: { message: errorMessage(e), login: e instanceof EFaturaError && e.loginFailed } }));
      } finally {
        setYukleniyor((y) => (y === a.from ? null : y));
      }
    },
    [offset, haric],
  );

  // Ay değişince (ya da hariç listesi gelince) hesapla; veriler önbellekten gelir
  useEffect(() => {
    void yukle(false);
  }, [yukle]);

  const sonucMetni = kdv ? (kdv.sonuc >= 0 ? 'Bu ay ödenecek KDV' : 'Sonraki aya devreden KDV') : '';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: wide ? 20 : 12, paddingHorizontal: wide ? 8 : 0, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => yukle(true)} />}>
      <View style={[styles.ayRow, wide && [styles.ayRowWide, { backgroundColor: st.card, borderColor: st.border }], { backgroundColor: wide ? st.card : theme.card }]}>
        <AyButon yon="left" label="Önceki ay" onPress={() => setOffset((o) => o - 1)} />
        <Text style={[wide ? styles.periodTextWide : t.headline, { color: wide ? st.cardForeground : theme.label }]}>{capitalizeTr(ay.label)}</Text>
        <AyButon yon="right" label="Sonraki ay" disabled={offset === 0} onPress={() => setOffset((o) => Math.min(0, o + 1))} />
      </View>

      {hata ? (
        <ListSection footer={hata.login ? `${hata.message}\n\nHesabınız kilitlenmesin diye otomatik olarak tekrar denenmez.` : hata.message}>
          <ListRow title={hata.login ? 'QNB girişi başarısız' : 'KDV hesaplanamadı'} subtitle="Tekrar denemek için dokunun" tone="action" onPress={() => yukle(true)} />
        </ListSection>
      ) : null}

      {!kdv && !hata ? <ActivityIndicator style={{ marginTop: 40 }} /> : null}

      {kdv ? (
        <View style={[styles.cards, wide && styles.cardsWide]}>
          <Kart
            baslik="Kestiğim KDV"
            aciklama="Giden faturalarımda müşteriden aldığım"
            tutar={kdv.kestigim.faturada}
            satirlar={[
              { ad: `Faturada yazan (${kdv.kestigim.adet} fatura)`, tutar: kdv.kestigim.faturada },
              ...(kdv.kestigim.tevkifat ? [{ ad: 'Alıcının ödediği tevkifat', tutar: -kdv.kestigim.tevkifat, soluk: true }] : []),
              ...(kdv.kestigim.tevkifat ? [{ ad: 'Benim beyan edeceğim', tutar: kdv.kestigim.beyan, kalin: true }] : []),
            ]}
          />
          <Kart
            baslik="Düşebileceğim KDV"
            aciklama="Gelen faturalarımda ve fişlerimde ödediğim"
            tutar={kdv.dusulebilir}
            satirlar={[
              { ad: `Gelen e-Faturalar (${kdv.gelenEfatura.adet})`, tutar: kdv.gelenEfatura.kdv },
              { ad: `Taranan fişler (${kdv.fis.adet})`, tutar: kdv.fis.kdv },
              ...(kdv.iade.adet ? [{ ad: `İade ettiğim alışlar (${kdv.iade.adet})`, tutar: -kdv.iade.kdv }] : []),
            ]}
            not={[
              kdv.fis.eslesen ? `${kdv.fis.eslesen} fiş bir e-Faturayla aynı alışveriş olduğu için iki kez sayılmadı.` : '',
              kdv.gelenEfatura.eksik ? `${kdv.gelenEfatura.eksik} e-Faturanın KDV bilgisi QNB'den gelmedi.` : '',
              kdv.iade.adet ? 'Kestiğim iade faturalarının KDV\'si, o alışları daha önce indirdiğim için buradan düşüldü.' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          <View
            style={[
              styles.sonuc,
              wide && [styles.kartWide, { backgroundColor: st.card, borderColor: st.border, borderWidth: 1 }],
              { backgroundColor: wide ? st.card : theme.label },
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={[t.footnote, styles.kartBaslik, { color: wide ? st.mutedForeground : theme.background, opacity: wide ? 1 : 0.75 }]}>
                {sonucMetni.toLocaleUpperCase('tr-TR')}
              </Text>
              {wide && (
                <Badge variant={kdv.sonuc > 0 ? 'destructive' : 'success'}>
                  {kdv.sonuc > 0 ? 'Ödenecek' : 'Devreden'}
                </Badge>
              )}
            </View>
            <Text style={[styles.buyuk, tabular, { color: wide ? st.cardForeground : theme.background }]}>
              {formatTL(Math.abs(kdv.sonuc))}
            </Text>
            <View style={[styles.ayrinti, { borderTopColor: wide ? st.border : theme.background, opacity: wide ? 1 : 0.85 }]}>
              <View style={styles.satir}>
                <Text style={[t.subhead, { color: wide ? st.mutedForeground : theme.background }]}>Beyan edeceğim KDV</Text>
                <Text style={[t.subhead, tabular, { color: wide ? st.cardForeground : theme.background, fontWeight: '600' }]}>{formatTL(kdv.kestigim.beyan)}</Text>
              </View>
              <View style={styles.satir}>
                <Text style={[t.subhead, { color: wide ? st.mutedForeground : theme.background }]}>Düşebileceğim KDV</Text>
                <Text style={[t.subhead, tabular, { color: wide ? st.cardForeground : theme.background, fontWeight: '600' }]}>
                  {kdv.dusulebilir >= 0 ? `−${formatTL(kdv.dusulebilir)}` : formatTL(-kdv.dusulebilir)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
      {kdv && yukleniyor === ay.from ? <ActivityIndicator style={{ marginBottom: 20 }} /> : null}

      <ListSection footer="Önceki aylardan devreden KDV bu hesapta yok. Bilgi amaçlıdır; beyanname için muhasebecinize danışın.">
        <ListRow
          title="Faturaları Gör"
          icon={{ sf: 'doc.richtext.fill', ion: 'document-text', color: theme.blue }}
          chevron
          onPress={() => router.navigate('/efatura')}
        />
        <ListRow
          title="Tüm Aylar"
          subtitle="Başlangıçtan bugüne özet"
          icon={{ sf: 'chart.bar.xaxis', ion: 'stats-chart', color: theme.purple }}
          chevron
          onPress={() => router.push('/efatura-ozet')}
        />
        <ListRow title="Vergi Takvimi" icon={{ sf: 'calendar', ion: 'calendar', color: theme.red }} chevron onPress={() => router.push('/tax-calendar')} />
      </ListSection>
    </ScrollView>
  );
}

function Kart({
  baslik,
  aciklama,
  tutar,
  satirlar,
  not,
}: {
  baslik: string;
  aciklama: string;
  tutar: number;
  satirlar: { ad: string; tutar: number; soluk?: boolean; kalin?: boolean }[];
  not?: string;
}) {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();
  return (
    <View
      style={[
        styles.kart,
        wide && [styles.kartWide, { backgroundColor: st.card, borderColor: st.border, borderWidth: 1 }],
        { backgroundColor: wide ? st.card : theme.card },
      ]}>
      <Text style={[t.footnote, styles.kartBaslik, { color: wide ? st.mutedForeground : theme.secondaryLabel }]}>
        {baslik.toLocaleUpperCase('tr-TR')}
      </Text>
      <Text style={[t.subhead, { color: wide ? st.mutedForeground : theme.secondaryLabel }]}>{aciklama}</Text>
      <Text style={[styles.buyuk, tabular, { color: wide ? st.cardForeground : theme.label }]}>{formatTL(tutar)}</Text>
      <View style={[styles.ayrinti, { borderTopColor: wide ? st.border : theme.separator }]}>
        {satirlar.map((s) => (
          <View key={s.ad} style={styles.satir}>
            <Text style={[t.subhead, { color: s.soluk ? (wide ? st.mutedForeground : theme.secondaryLabel) : wide ? st.cardForeground : theme.label, fontWeight: s.kalin ? '600' : '400', flexShrink: 1 }]}>
              {s.ad}
            </Text>
            <Text
              style={[
                t.subhead,
                tabular,
                {
                  color: s.soluk ? (wide ? st.mutedForeground : theme.secondaryLabel) : wide ? st.cardForeground : theme.label,
                  fontWeight: s.kalin ? '600' : '400',
                },
              ]}>
              {s.tutar < 0 ? `−${formatTL(-s.tutar)}` : formatTL(s.tutar)}
            </Text>
          </View>
        ))}
      </View>
      {not ? <Text style={[t.footnote, { color: wide ? st.mutedForeground : theme.secondaryLabel, marginTop: 4 }]}>{not}</Text> : null}
    </View>
  );
}

function AyButon({ yon, label, onPress, disabled }: { yon: 'left' | 'right'; label: string; onPress: () => void; disabled?: boolean }) {
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
          width: 36,
          height: 36,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
        },
        hovered && wide && { backgroundColor: st.muted },
      ]}>
      <Icon sf={`chevron.${yon}`} ion={yon === 'left' ? 'chevron-back' : 'chevron-forward'} size={16} color={wide ? st.cardForeground : theme.blue} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ayRowWide: { alignSelf: 'flex-start', width: 280, marginBottom: 20, borderWidth: 1, borderRadius: 8, paddingHorizontal: 4 },
  periodTextWide: { fontFamily, fontSize: 13, fontWeight: '600' },
  cardsWide: { flexDirection: 'row', alignItems: 'stretch', gap: 16, marginBottom: 28 },
  kartWide: { flex: 1, minWidth: 0, borderRadius: 8, padding: 18 },
  ayRow: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  cards: { marginHorizontal: 16, gap: 12, marginBottom: 20 },
  kart: { borderRadius: 14, padding: 16, gap: 4 },
  kartBaslik: { fontWeight: '600', letterSpacing: 0.3 },
  buyuk: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  ayrinti: { marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  satir: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  sonuc: { borderRadius: 14, padding: 16, gap: 4 },
});
