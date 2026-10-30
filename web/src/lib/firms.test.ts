import { describe, expect, it } from "vitest";
import { getFirmMergeSuggestions } from "./firms";
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
