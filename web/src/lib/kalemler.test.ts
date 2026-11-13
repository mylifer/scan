import { describe, expect, it, vi } from "vitest";
import type { KalemDenemeSonucu } from "./kalemler";

const invoke = vi.fn();
vi.mock("./supabase", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

const { kalemDenemesiYap } = await import("./kalemler");

const tur = (okundu: number, kalan: number, dolan: string[] = []): KalemDenemeSonucu => ({
  calisti: true,
  okundu,
  tutarli: okundu,
  bos: 0,
  okunamadi: 0,
  dolanModeller: dolan,
  kalan,
  sonuclar: Array.from({ length: okundu }, (_, i) => ({
    id: `${kalan}-${i}`, firma: "F", toplam: 10, kalemAdedi: 1, kalemToplami: 10, tutarli: true, model: "m",
  })),
});

describe("eski fiş kalem denemesi", () => {
  it("istenen sayıya ulaşana kadar kalan adetle art arda çağrılır ve sonuçlar birleşir", async () => {
    invoke.mockReset();
    invoke.mockResolvedValueOnce({ data: tur(8, 92), error: null }).mockResolvedValueOnce({ data: tur(8, 84), error: null }).mockResolvedValueOnce({ data: tur(4, 80), error: null });
    const r = await kalemDenemesiYap("gemini-2.5-flash", 20);
    expect(invoke.mock.calls.map((c) => (c[1] as { body: { adet: number } }).body.adet)).toEqual([20, 12, 4]);
    expect(r.okundu).toBe(20);
    expect(r.sonuclar).toHaveLength(20);
    expect(r.kalan).toBe(80);
  });

  it("kota dolunca ya da bekleyen fiş bitince durur", async () => {
    invoke.mockReset();
    invoke.mockResolvedValueOnce({ data: tur(3, 50, ["gemini-2.5-flash"]), error: null });
    expect((await kalemDenemesiYap("gemini-2.5-flash", 20)).dolanModeller).toEqual(["gemini-2.5-flash"]);
    expect(invoke).toHaveBeenCalledTimes(1);

    invoke.mockReset();
    invoke.mockResolvedValueOnce({ data: tur(2, 0), error: null });
    await kalemDenemesiYap("gemini-3.5-flash-lite", 20);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("sunucu hatası mesajıyla iletilir", async () => {
    invoke.mockReset();
    invoke.mockResolvedValueOnce({ data: null, error: Object.assign(new Error("HTTP 401"), { context: new Response(JSON.stringify({ message: "Giriş yapmanız gerekiyor." })) }) });
    await expect(kalemDenemesiYap("gemini-2.5-flash", 5)).rejects.toThrow("Giriş yapmanız gerekiyor.");
  });
});
