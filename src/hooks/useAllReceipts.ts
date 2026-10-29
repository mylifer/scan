import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { errorMessage } from '../lib/errors';
import { round2 } from '../lib/format';
import { readCache, writeCache } from '../lib/offlineCache';
import { getSummary } from '../services/supabase/receiptsRepository';
import type { ReceiptRecord } from '../types/receipt';
import { useAuth } from './useAuth';

/** Önbellekte fiş başına dizi (alan adları tekrar edilmez; ~2 kat daha çok fiş sığar). Fotoğraf yolu gerekmez. */
type Packed = [string, string, string, string, number, number, number, number, string, string?, string?, string?, string[]?, string?];
const pack = (r: ReceiptRecord): Packed => {
  const p: Packed = [r.id, r.created_at, r.firma_adi, r.tarih, r.toplam_tutar, r.kdv_yuzde1, r.kdv_yuzde10, r.kdv_yuzde20, r.kategori];
  // Ek alanlar yalnızca doluysa yazılır (önbellek küçük kalsın)
  if (r.fis_no || r.vkn || r.notlar || r.etiketler.length || r.muhasebe_gonderildi_at) p.push(r.fis_no ?? '', r.vkn ?? '', r.notlar ?? '', r.etiketler);
  if (r.muhasebe_gonderildi_at) p.push(r.muhasebe_gonderildi_at);
  return p;
};
const unpack = (p: Packed): ReceiptRecord => ({
  id: p[0],
  created_at: p[1],
  firma_adi: p[2],
  tarih: p[3],
  toplam_tutar: p[4],
  kdv_yuzde1: p[5],
  kdv_yuzde10: p[6],
  kdv_yuzde20: p[7],
  toplam_kdv: round2(p[5] + p[6] + p[7]),
  kategori: p[8],
  image_path: null,
  fis_no: p[9] || null,
  vkn: p[10] || null,
  notlar: p[11] || null,
  etiketler: p[12] ?? [],
  muhasebe_gonderildi_at: p[13] || null,
});

/**
 * Bugüne kadarki tüm fişler (Tüm Fişler, Firmalar ve Firma Detayı ekranları için).
 * Ekran her odaklandığında yenilenir; internet yokken cihazdaki son kopya gösterilir.
 */
export function useAllReceipts() {
  const owner = useAuth().session?.user.id ?? '';
  const [receipts, setReceipts] = useState<ReceiptRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const req = ++latest.current;
    setLoading(true);
    if (owner) {
      const cached = await readCache<Packed[]>('receipts:v3', owner);
      if (req === latest.current && cached) setReceipts((cur) => cur ?? cached.value.map(unpack));
    }
    try {
      const { fisler } = await getSummary();
      if (req !== latest.current) return;
      setReceipts(fisler);
      setError(null);
      if (owner) writeCache('receipts:v3', owner, fisler.map(pack));
    } catch (e) {
      if (req === latest.current) setError(errorMessage(e));
    } finally {
      if (req === latest.current) setLoading(false);
    }
  }, [owner]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return { receipts, error, loading, refresh };
}
