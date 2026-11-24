import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { BOS_SATICI, saticiOku, saticiYaz, sayiOku, seriTemizle } from "./faturaKes";

describe("fatura kesme yardımcıları", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sayı okuma: Türkçe ve noktalı biçim", () => {
    expect(sayiOku("1.234,5")).toBe(1234.5);
    expect(sayiOku("1234.5")).toBe(1234.5);
    expect(sayiOku("12,00")).toBe(12);
    expect(sayiOku("")).toBeNaN();
    expect(sayiOku("abc")).toBeNaN();
  });

  it("seri: büyük harf, 3 karakter, Türkçe harf yok", () => {
    expect(seriTemizle("abc")).toBe("ABC");
    expect(seriTemizle("ea-2026")).toBe("EA2");
    expect(seriTemizle("işç")).toBe("");
  });

  it("satıcı bilgisi saklanır; depolama yoksa boş döner", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    saticiYaz({ ...BOS_SATICI, unvan: "Örnek Ltd.", efaturaSeri: "ABC" });
    expect(saticiOku()).toMatchObject({ unvan: "Örnek Ltd.", efaturaSeri: "ABC", il: "" });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("engelli");
      },
    });
    expect(saticiOku()).toEqual(BOS_SATICI);
  });
});
