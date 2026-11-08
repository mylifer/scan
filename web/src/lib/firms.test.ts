import { describe, expect, it } from "vitest";
import { filterFirmsByName, getFirmMergeSuggestions } from "./firms";
import type { ReceiptRecord } from "@shared/types/receipt";

describe("firms helper", () => {
  it("benzer yazılan firma varyantlarını gruplar", () => {
    const receipts = [
      { id: "1", firma_adi: "Migros Ticaret A.Ş.", toplam_tutar: 100 } as ReceiptRecord,
      { id: "2", firma_adi: "Migros", toplam_tutar: 50 } as ReceiptRecord,
      { id: "3", firma_adi: "Shell Petrol A.Ş.", toplam_tutar: 200 } as ReceiptRecord,
    ];

    const groups = getFirmMergeSuggestions(receipts);
    expect(groups.length).toBeGreaterThan(0);
    const migrosGroup = groups.find((g) => g.variants.some((v) => v.name.includes("Migros")));
    expect(migrosGroup).toBeDefined();
    expect(migrosGroup?.variants.length).toBe(2);
  });
});

describe("filterFirmsByName", () => {
  const firms = [{ name: "MİGROS TİCARET A.Ş." }, { name: "Işık Market" }, { name: "Shell" }];
  it("Türkçe büyük/küçük harften bağımsız arar", () => {
    expect(filterFirmsByName(firms, "ticaret").map((f) => f.name)).toEqual(["MİGROS TİCARET A.Ş."]);
    expect(filterFirmsByName(firms, "IŞIK").map((f) => f.name)).toEqual(["Işık Market"]);
    expect(filterFirmsByName(firms, " ")).toHaveLength(3);
  });
});
