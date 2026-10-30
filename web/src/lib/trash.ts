import { round2 } from "@shared/lib/format";
import { trashCutoff, trashDaysLeft, trashLeftLabel, TRASH_DAYS } from "@shared/lib/trash";
import type { ReceiptRecord } from "@shared/types/receipt";
import { supabase } from "./supabase";

export { trashCutoff, trashDaysLeft, trashLeftLabel, TRASH_DAYS };

const TRASH_TABLE = "receipt_trash";
const RECEIPTS_TABLE = "receipts";
const BUCKET = "receipt-images";

export interface TrashItem {
  id: string;
  deleted_at: string;
  receipt: ReceiptRecord;
}

function toRecord(raw: Record<string, unknown>): ReceiptRecord {
  const kdv1 = Number(raw.kdv_yuzde1 ?? 0);
  const kdv10 = Number(raw.kdv_yuzde10 ?? 0);
  const kdv20 = Number(raw.kdv_yuzde20 ?? 0);
  return {
    id: String(raw.id ?? ""),
    created_at: String(raw.created_at ?? ""),
    firma_adi: String(raw.firma_adi ?? ""),
    tarih: String(raw.tarih ?? ""),
    toplam_tutar: Number(raw.toplam_tutar ?? 0),
    kdv_yuzde1: kdv1,
    kdv_yuzde10: kdv10,
    kdv_yuzde20: kdv20,
    toplam_kdv: round2(kdv1 + kdv10 + kdv20),
    kategori: (raw.kategori as ReceiptRecord["kategori"]) ?? "diğer",
    image_path: raw.image_path ? String(raw.image_path) : null,
    fis_no: raw.fis_no ? String(raw.fis_no) : null,
    vkn: raw.vkn ? String(raw.vkn) : null,
    notlar: raw.notlar ? String(raw.notlar) : null,
    etiketler: Array.isArray(raw.etiketler) ? raw.etiketler.map(String) : [],
    muhasebe_gonderildi_at: raw.muhasebe_gonderildi_at ? String(raw.muhasebe_gonderildi_at) : null,
  };
}

/** Çöp kutusundaki fişleri çeker */
export async function listTrash(): Promise<TrashItem[]> {
  const { data, error } = await supabase
    .from(TRASH_TABLE)
    .select("*")
    .order("deleted_at", { ascending: false })
    .limit(500);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw new Error(`Çöp kutusu yüklenemedi: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: unknown; deleted_at: unknown; receipt: unknown }>;
  return rows.map((r) => {
    const rec = (r.receipt ?? {}) as Record<string, unknown>;
    const record = toRecord({ ...rec, id: r.id });
    return {
      id: String(r.id),
      deleted_at: String(r.deleted_at),
      receipt: record,
    };
  });
}

/** Fişi geri yükler */
export async function restoreFromTrash(item: TrashItem): Promise<void> {
  const r = item.receipt;
  const { error } = await supabase.from(RECEIPTS_TABLE).insert({
    id: r.id,
    created_at: r.created_at,
    firma_adi: r.firma_adi,
    tarih: r.tarih,
    toplam_tutar: r.toplam_tutar,
    kdv_yuzde1: r.kdv_yuzde1,
    kdv_yuzde10: r.kdv_yuzde10,
    kdv_yuzde20: r.kdv_yuzde20,
    kategori: r.kategori,
    image_path: r.image_path,
    ...(r.fis_no ? { fis_no: r.fis_no } : {}),
    ...(r.vkn ? { vkn: r.vkn } : {}),
    ...(r.notlar ? { notlar: r.notlar } : {}),
    ...(r.etiketler?.length ? { etiketler: r.etiketler } : {}),
    ...(r.muhasebe_gonderildi_at ? { muhasebe_gonderildi_at: r.muhasebe_gonderildi_at } : {}),
  });

  if (error && error.code !== "23505") {
    throw new Error(`Fiş geri yüklenemedi: ${error.message}`);
  }

  const { error: trashError } = await supabase.from(TRASH_TABLE).delete().eq("id", item.id);
  if (trashError) {
    throw new Error(`Fiş geri alındı ancak çöp kutusundan kaldırılamadı: ${trashError.message}`);
  }
}

/** Seçilen çöp kayıtlarını ve sahipsiz fotoğraflarını kalıcı olarak siler */
export async function purgeTrash(items: TrashItem[]): Promise<void> {
  if (!items.length) return;

  const ids = items.map((i) => i.id);
  const { data, error } = await supabase
    .from(TRASH_TABLE)
    .delete()
    .in("id", ids)
    .select("id, receipt");

  if (error) {
    throw new Error(`Kalıcı olarak silinemedi: ${error.message}`);
  }

  const deletedRows = (data ?? []) as Array<{ id: unknown; receipt: unknown }>;
  const paths = [
    ...new Set(
      deletedRows
        .map((r) => (r.receipt as { image_path?: unknown } | null)?.image_path)
        .filter((p): p is string => typeof p === "string" && !!p)
    ),
  ];

  if (!paths.length) return;

  // Fotoğraf başka bir canlı fişte kullanılıyor mu?
  const { data: live, error: liveError } = await supabase
    .from(RECEIPTS_TABLE)
    .select("image_path")
    .in("image_path", paths);

  if (liveError) return;

  const liveRows = (live ?? []) as Array<{ image_path: unknown }>;
  const used = new Set(liveRows.map((r) => String(r.image_path)));
  const orphans = paths.filter((p) => !used.has(p));
  if (orphans.length > 0) {
    await supabase.storage.from(BUCKET).remove(orphans);
  }
}
