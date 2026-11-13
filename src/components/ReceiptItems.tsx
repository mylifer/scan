import { useEffect, useState } from 'react';

import { formatTL } from '../lib/format';
import { type FisKalemi, kalemlerTutarli, kalemToplami } from '../lib/kalemler';
import { supabase } from '../services/supabase/client';
import { fisKalemleriniGetir } from '../services/supabase/receiptRows';
import { ListRow, ListSection } from './ui/List';

const adetMetni = (k: FisKalemi) => {
  const miktar = k.miktar.toLocaleString('tr-TR', { maximumFractionDigits: 3 });
  const birim = k.birim ? ` ${k.birim}` : '';
  return k.birimFiyat ? `${miktar}${birim} × ${formatTL(k.birimFiyat)}` : `${miktar}${birim}`;
};

/** Fişin okunan ürün/hizmet satırları; kalem yoksa hiçbir şey çizmez */
export function ReceiptItems({ receiptId, toplamTutar }: { receiptId: string; toplamTutar: number }) {
  const [kalemler, setKalemler] = useState<FisKalemi[]>([]);

  useEffect(() => {
    let iptal = false;
    void fisKalemleriniGetir(supabase, receiptId).then((k) => {
      if (!iptal) setKalemler(k);
    });
    return () => {
      iptal = true;
    };
  }, [receiptId]);

  if (!kalemler.length) return null;
  const toplam = kalemToplami(kalemler);
  return (
    <ListSection
      header={`Kalemler (${kalemler.length})`}
      footer={
        kalemlerTutarli(kalemler, toplamTutar)
          ? 'Yapay zekâ ile okundu; kalem toplamı fiş toplamıyla tutarlı.'
          : `Yapay zekâ ile okundu. Kalem toplamı ${formatTL(toplam)}, fiş toplamını tutmuyor: bazı satırlar eksik ya da yanlış okunmuş olabilir.`
      }>
      {kalemler.map((k, i) => (
        <ListRow key={i} title={k.ad} subtitle={adetMetni(k)} value={formatTL(k.tutar)} />
      ))}
    </ListSection>
  );
}
