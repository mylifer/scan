import { aggregateFirms, type FirmListItem } from "@shared/lib/firms";
import { findFirmGroups, type FirmGroup } from "@shared/lib/firmMerge";
import type { ReceiptRecord } from "@shared/types/receipt";
import { listReceipts } from "@/lib/receipts";
import { supabase } from "@/lib/supabase";

export type { FirmGroup, FirmListItem };

export async function loadFirmList(): Promise<{ firms: FirmListItem[]; allReceipts: ReceiptRecord[] }> {
  const receipts = await listReceipts();
  const firms = aggregateFirms(receipts);
  return { firms, allReceipts: receipts };
}

/** Firma adı varyantlarını bulur */
export function getFirmMergeSuggestions(receipts: ReceiptRecord[]): FirmGroup[] {
  const nameCounts = new Map<string, number>();
  for (const r of receipts) {
    const name = r.firma_adi.trim();
    if (name) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  return findFirmGroups(nameCounts);
}

/** Firma adlarını topluca günceller / birleştirir */
export async function renameFirms(from: string[], to: string): Promise<number> {
  const names = from.filter((n) => n !== to);
  if (names.length === 0) return 0;

  const plain = names.filter((n) => !n.includes('"'));
  const quoted = names.filter((n) => n.includes('"'));
  let changed = 0;

  if (plain.length > 0) {
    const { data, error } = await supabase
      .from("receipts")
      .update({ firma_adi: to.trim() })
      .in("firma_adi", plain)
      .select("id");
    if (error) throw new Error(`Firma adları güncellenemedi: ${error.message}`);
    changed += data?.length ?? 0;
  }

  for (const n of quoted) {
    const { data, error } = await supabase
      .from("receipts")
      .update({ firma_adi: to.trim() })
      .eq("firma_adi", n)
      .select("id");
    if (error) throw new Error(`Firma adları güncellenemedi: ${error.message}`);
    changed += data?.length ?? 0;
  }

  return changed;
}
