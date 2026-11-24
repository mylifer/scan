import { describe, expect, it } from "vitest";
import { formatTL } from "@shared/lib/format";
import { NAV_ITEMS, titleForPath } from "./nav";

describe("nav", () => {
  it("başlığı yoldan bulur", () => {
    expect(titleForPath("/kdv/")).toBe("KDV");
    expect(titleForPath("/vergi-takvimi")).toBe("Vergi Takvimi");
    expect(titleForPath("/")).toBe("Fişler");
  });
  it("9 menü öğesi var", () => expect(NAV_ITEMS).toHaveLength(9));
  it("fatura kes sayfası", () => expect(titleForPath("/fatura-kes/")).toBe("Fatura Kes"));
});

describe("@shared", () => {
  it("Expo uygulamasındaki saf TS modülü içe aktarılabilir", () => {
    expect(formatTL(1234.5)).toContain("1.234,50");
  });
});
