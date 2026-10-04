import { router } from 'expo-router';
import { useState } from 'react';

import { formatTL } from '../lib/format';
import { groupByMonth, type SortKey } from '../lib/sort';
import type { ReceiptRecord } from '../types/receipt';
import { ReceiptRow } from './dashboard/ReceiptRow';
import { ListRow, ListSection } from './ui/List';

const PAGE = 50;

interface Props {
  /** Sıralanmış fişler */
  receipts: ReceiptRecord[];
  sort: SortKey;
  /** Düz listede bölüm başlığı (tarihe göre sıralıyken aylara bölünür) */
  header?: string;
  headerAction?: { label: string; onPress: () => void; accessibilityLabel?: string };
}

/**
 * Fiş listesi: tarihe göre sıralıyken aylara ayrılır (ay başlığında fiş sayısı ve toplam),
 * tutara göre sıralıyken düz liste. 50'şer gösterilir. Fişe dokununca detay açılır.
 */
export function ReceiptList({ receipts, sort, header, headerAction }: Props) {
  const [visible, setVisible] = useState(PAGE);
  // Liste değişince (arama, sıralama) baştan göster
  const [shownFor, setShownFor] = useState(receipts);
  if (shownFor !== receipts) {
    setShownFor(receipts);
    setVisible(PAGE);
  }

  const shown = receipts.slice(0, visible);
  const row = (r: ReceiptRecord) => <ReceiptRow key={r.id} receipt={r} onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: r.id } })} />;
  const more =
    receipts.length > visible ? (
      <ListRow key="more" title={`${receipts.length - visible} fiş daha göster`} tone="action" onPress={() => setVisible((v) => v + PAGE)} />
    ) : null;

  if (sort === 'newest' || sort === 'oldest') {
    // Ay başlıklarındaki sayı/toplam, yalnızca gösterilenleri değil ayın tüm fişlerini yansıtır
    const totals = new Map<string, { count: number; total: number }>();
    for (const r of receipts) {
      const k = r.tarih.slice(0, 7);
      const t = totals.get(k) ?? { count: 0, total: 0 };
      t.count++;
      t.total += r.toplam_tutar;
      totals.set(k, t);
    }
    const groups = groupByMonth(shown);
    return (
      <>
        {groups.map((g, i) => {
          const t = totals.get(g.key);
          const last = i === groups.length - 1;
          return (
            <ListSection
              key={g.key}
              header={`${g.label} · ${t?.count ?? g.items.length} fiş · ${formatTL(t?.total ?? 0)}`}
              headerAction={i === 0 ? headerAction : undefined}>
              {[...g.items.map(row), ...(last && more ? [more] : [])]}
            </ListSection>
          );
        })}
      </>
    );
  }

  return (
    <ListSection header={header} headerAction={headerAction}>
      {[...shown.map(row), ...(more ? [more] : [])]}
    </ListSection>
  );
}
