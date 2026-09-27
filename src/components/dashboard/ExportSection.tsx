import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { showAlert } from '../../lib/alert';
import { errorMessage } from '../../lib/errors';
import { capitalizeTr } from '../../lib/format';
import { haptics } from '../../lib/haptics';
import type { PeriodRange } from '../../lib/period';
import { useTheme } from '../../lib/theme';
import { showToast } from '../../lib/toast';
import { buildAccountingPackage } from '../../services/export/exportPackage';
import { buildReceiptsWorkbook, exportFilename, shareXlsx, shareZip } from '../../services/export/exportReceipts';
import type { PeriodSummary } from '../../services/supabase/receiptsRepository';
import { ListRow, ListSection } from '../ui/List';

/** Dönemin fişlerini Excel ya da Excel + fotoğraflar (ZIP) olarak paylaşma. */
export function ExportSection({ summary: s, label, range }: { summary: PeriodSummary; label: string; range: PeriodRange | undefined }) {
  const theme = useTheme();
  const [exporting, setExporting] = useState(false);
  const [packing, setPacking] = useState<{ done: number; total: number } | null>(null);

  async function exportPackage() {
    if (packing) return;
    setPacking({ done: 0, total: 0 });
    try {
      const { bytes, failed } = await buildAccountingPackage(s, capitalizeTr(label), exportFilename(range), (done, total) => setPacking({ done, total }));
      await shareZip(bytes, exportFilename(range, 'zip'));
      if (failed) showToast(`${failed} fotoğraf indirilemedi; paket onlarsız oluşturuldu`, 'error', 4000);
      else haptics.success();
    } catch (e) {
      showAlert('Paket oluşturulamadı', errorMessage(e));
    } finally {
      setPacking(null);
    }
  }

  async function exportExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      await shareXlsx(buildReceiptsWorkbook(s, capitalizeTr(label)), exportFilename(range));
      haptics.success();
    } catch (e) {
      showAlert('Dışa aktarılamadı', errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <ListSection footer="Muhasebecinize e-posta, WhatsApp ya da Dosyalar ile gönderebilirsiniz.">
      <ListRow
        title="Excel'e Aktar"
        subtitle={`${capitalizeTr(label)} · ${s.fisSayisi} fiş`}
        icon={{ sf: 'tablecells.fill', ion: 'grid', color: theme.green }}
        onPress={exportExcel}
        disabled={exporting}
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
            : `Excel + ${s.fisler.filter((r) => r.image_path).length} fiş fotoğrafı`
        }
        icon={{ sf: 'archivebox.fill', ion: 'archive', color: theme.orange }}
        onPress={exportPackage}
        disabled={!!packing}
        accessory={packing ? <ActivityIndicator /> : undefined}
        chevron={!packing}
      />
    </ListSection>
  );
}
