import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';

import { ListRow, ListSection } from '../components/ui/List';
import { errorMessage } from '../lib/errors';
import { useTheme } from '../lib/theme';
import { base64ToBytes } from '../../supabase/functions/qnb-efatura/soap';
import { showAlert } from '../lib/alert';
import { EFaturaError, type FaturaDetay, getEFaturaDetay, getEFaturaPdf, type Tur, type Yon } from '../services/efatura/qnbEfatura';
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
      const b64 = await getEFaturaPdf((name, options) => supabase.functions.invoke(name, options), yon, ettn, tur);
      const ad = (detay?.belgeNo || params.belgeNo || ettn).replace(/[^\w-]/g, '_');
      await sharePdf(base64ToBytes(b64), `${ad}.pdf`);
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
