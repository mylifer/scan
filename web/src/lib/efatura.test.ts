import { describe, expect, it } from "vitest";
import { donemCacheKey, getMonthBounds } from "./efatura";

describe("efatura web helpers", () => {
  it("getMonthBounds doğru başlangıç ve bitiş tarihlerini üretir", () => {
    const bounds = getMonthBounds(0);
    expect(bounds.baslangic).toMatch(/^\d{4}-\d{2}-01$/);
    expect(bounds.bitis).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bounds.fileTag).toMatch(/^\d{4}-\d{2}$/);
    expect(bounds.label).toBeTruthy();
  });

  it("donemCacheKey yön ve tarihi birleştirir", () => {
    expect(donemCacheKey("gelen", "2026-10-01")).toBe("gelen:2026-10-01");
    expect(donemCacheKey("giden", "2026-09-01")).toBe("giden:2026-09-01");
  });
});
