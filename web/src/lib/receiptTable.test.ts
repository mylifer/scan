import { describe, expect, it } from "vitest";
import type { ReceiptRecord } from "@shared/types/receipt";
import { periodFromKey, periodOptions, sortRows } from "./receiptTable";

const r = (id: string, tarih: string, firma: string, tutar: number): ReceiptRecord => ({
  id, created_at: `${tarih}T10:00:00Z`, firma_adi: firma, tarih, toplam_tutar: tutar,
  kdv_yuzde1: 0, kdv_yuzde10: 0, kdv_yuzde20: 0, toplam_kdv: 0, kategori: "market",
  image_path: null, fis_no: null, vkn: null, notlar: null, etiketler: [], muhasebe_gonderildi_at: null,
});

describe("sortRows", () => {
  const rows = [r("1", "2026-09-01", "Şok", 50), r("2", "2026-09-03", "Migros", 20), r("3", "2026-09-02", "Çağrı", 80)];
  it("tarihe göre", () => expect(sortRows(rows, { column: "tarih", dir: "desc" }).map((x) => x.id)).toEqual(["2", "3", "1"]));
  it("tutara göre artan", () => expect(sortRows(rows, { column: "toplam_tutar", dir: "asc" }).map((x) => x.id)).toEqual(["2", "1", "3"]));
  it("firma Türkçe sıralama", () => expect(sortRows(rows, { column: "firma_adi", dir: "asc" }).map((x) => x.firma_adi)).toEqual(["Çağrı", "Migros", "Şok"]));
});

describe("dönem", () => {
  it("anahtar çözümleme", () => {
    expect(periodFromKey("m-2")).toEqual({ mode: "month", offset: -2 });
    expect(periodFromKey("y0")).toEqual({ mode: "year", offset: 0 });
    expect(periodFromKey("all")).toEqual({ mode: "all" });
  });
  it("seçenekler", () => {
    const o = periodOptions(new Date(2026, 8, 15));
    expect(o[0].key).toBe("m0");
    expect(o.at(-1)?.label).toBe("Tüm zamanlar");
    expect(o).toHaveLength(16);
  });
});
