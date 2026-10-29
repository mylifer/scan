import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Switch } from 'react-native';

import { ListRow, ListSection } from '../components/ui/List';
import { aylarArasi, ayAraligi, type DonemOzet, HARIC_KEY, indirilecekKdv, kdvFarki, OLAGANDISI_DAHIL_KEY, olaganDisi, ozetle } from '../lib/efaturaOzet';
import { errorMessage } from '../lib/errors';
import { capitalizeTr } from '../lib/format';
import { useTheme } from '../lib/theme';
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
