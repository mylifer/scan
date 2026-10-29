import { useMemo, useState } from 'react';
import { ActivityIndicator, Switch } from 'react-native';

import { showAlert } from '../../lib/alert';
import { errorMessage } from '../../lib/errors';
import { capitalizeTr } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { PeriodRange } from '../../lib/period';
import { useTheme } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import { useExcludeSent } from '../../lib/exportPrefs';
import { summarizeReceipts } from '../../lib/summary';
import { buildAccountingPackage } from '../../services/export/exportPackage';
import { buildReceiptsWorkbook, exportFilename, shareXlsx, shareXlsxStream, shareZipStream, writeReceiptsWorkbookWithPhotos } from '../../services/export/exportReceipts';
import { downloadBytes } from '../../services/supabase/storageFiles';
import type { PeriodSummary } from '../../services/supabase/receiptsRepository';
import { ListRow, ListSection } from '../ui/List';

/** Dönemin fişlerini Excel ya da Excel + fotoğraflar (ZIP) olarak paylaşma. */
export function ExportSection({ summary: all, label, range }: { summary: PeriodSummary; label: string; range: PeriodRange | undefined }) {
  const theme = useTheme();
  // Muhasebeciye gönderilmiş fişler isteğe bağlı olarak dışarıda bırakılır (dışa aktarım hiçbir fişi işaretlemez)
  const [excludeSent, setExcludeSent] = useExcludeSent();
  const sentCount = useMemo(() => all.fisler.filter((r) => r.muhasebe_gonderildi_at).length, [all]);
  const s = useMemo(
    () => (excludeSent && sentCount ? summarizeReceipts(all.fisler.filter((r) => !r.muhasebe_gonderildi_at)) : all),
    [all, excludeSent, sentCount],
  );
  const empty = s.fisSayisi === 0;
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null);
  const photoCount = s.fisler.filter((r) => r.image_path).length;
  const [packing, setPacking] = useState<{ done: number; total: number } | null>(null);

  async function exportPackage() {
    if (packing || empty) return;
    setPacking({ done: 0, total: 0 });
    try {
      const { failed } = await shareZipStream(exportFilename(range, 'zip'), (sink) =>
        buildAccountingPackage(s, capitalizeTr(label), exportFilename(range), sink, (done, total) => setPacking({ done, total })),
      );
      if (failed) showToast(`${failed} fotoğraf indirilemedi; paket onlarsız oluşturuldu`, 'error', 4000);
      else haptics.success();
    } catch (e) {
      showAlert('Paket oluşturulamadı', errorMessage(e));
    } finally {
      setPacking(null);
    }
  }

  /** Excel: fiş fotoğrafları da içine eklenir (küçük resim + tıklanınca tam boyut) */
  async function exportExcel() {
    if (exporting || empty) return;
    setExporting({ done: 0, total: 0 });
    try {
      const name = exportFilename(range);
      if (!photoCount) {
        await shareXlsx(buildReceiptsWorkbook(s, capitalizeTr(label)), name);
        haptics.success();
        return;
      }
      const { failed } = await shareXlsxStream(name, (sink) =>
        writeReceiptsWorkbookWithPhotos(s, capitalizeTr(label), sink, downloadBytes, (done, total) => setExporting({ done, total })),
      );
      if (failed) showToast(`${failed} fotoğraf indirilemedi; Excel onlarsız oluşturuldu`, 'error', 4000);
      else haptics.success();
    } catch (e) {
      showAlert('Dışa aktarılamadı', errorMessage(e));
    } finally {
      setExporting(null);
    }
  }

  return (
    <ListSection
      footer={
        sentCount
          ? excludeSent
            ? empty
              ? `Bu dönemin bütün fişleri (${sentCount}) muhasebeciye gönderildi olarak işaretli. Hepsini aktarmak için yukarıdaki anahtarı kapatın.`
              : `${all.fisSayisi} fişin ${sentCount} tanesi daha önce gönderildi; ${s.fisSayisi} fiş aktarılacak. Gönderdiklerinizi fişin detayından ya da "Seç" ile işaretleyin.`
            : `${all.fisSayisi} fişin hepsi aktarılacak (${sentCount} tanesi daha önce gönderildi).`
          : 'Muhasebecinize e-posta, WhatsApp ya da Dosyalar ile gönderebilirsiniz. Gönderdiğiniz fişleri işaretlerseniz sonraki aktarımda hariç tutabilirsiniz.'
      }>
      {sentCount ? (
        <ListRow
          title="Gönderilenleri Hariç Tut"
          icon={{ sf: 'paperplane.fill', ion: 'paper-plane', color: theme.green }}
          accessory={<Switch value={excludeSent} onValueChange={setExcludeSent} accessibilityLabel="Muhasebeciye gönderilenleri hariç tut" />}
        />
      ) : null}
      <ListRow
        title="Excel'e Aktar"
        subtitle={
          exporting?.total
            ? `Fotoğraflar ekleniyor ${exporting.done}/${exporting.total}`
            : `${capitalizeTr(label)} · ${s.fisSayisi} fiş${photoCount ? ' · fotoğraflı' : ''}`
        }
        icon={{ sf: 'tablecells.fill', ion: 'grid', color: theme.green }}
        onPress={exportExcel}
        disabled={!!exporting || empty}
        accessory={exporting ? <ActivityIndicator /> : undefined}
        chevron={!exporting}
      />
      <ListRow
        title="Muhasebe Paketi (ZIP)"
        subtitle={
          packing
            ? packing.total
              ? `Fotoğraflar indiriliyor ${packing.done}/${packing.total}`
              : 'Hazırlanıyor…'
            : `Excel + ${photoCount} fiş fotoğrafı (ayrı dosyalar)`
        }
        icon={{ sf: 'archivebox.fill', ion: 'archive', color: theme.orange }}
        onPress={exportPackage}
        disabled={!!packing || empty}
        accessory={packing ? <ActivityIndicator /> : undefined}
        chevron={!packing}
      />
    </ListSection>
  );
}
