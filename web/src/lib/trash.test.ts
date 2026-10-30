import { describe, expect, it } from "vitest";
import { trashDaysLeft, trashLeftLabel } from "./trash";

describe("trash helpers", () => {
  it("kalan gün hesaplar ve etiket üretir", () => {
    const today = new Date("2026-10-30T12:00:00Z");
    const deletedYesterday = "2026-10-29T10:00:00Z";
    const left = trashDaysLeft(deletedYesterday, today);
    expect(left).toBe(29);
    expect(trashLeftLabel(left)).toBe("29 gün kaldı");

    expect(trashLeftLabel(1)).toBe("Yarın silinecek");
    expect(trashLeftLabel(0)).toBe("Bugün silinecek");
  });
});
