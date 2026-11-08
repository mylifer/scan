import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EFatura } from "@shared/services/efatura/qnbEfatura";

const listEFaturalar = vi.fn();

vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@shared/services/efatura/qnbEfatura", async (orig) => ({
  ...(await orig<typeof import("@shared/services/efatura/qnbEfatura")>()),
  listEFaturalar: (...args: unknown[]) => listEFaturalar(...args),
}));

const { clearEFaturaCaches, fetchDonemFaturalar, readPersistedDonem, setEFaturaCacheOwner } = await import("./efatura");

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
  };
}

const fatura = (ettn: string): EFatura => ({
  ettn,
  belgeNo: ettn,
  tarih: "2026-11-01",
  unvan: "Firma",
  vkn: "1",
  tutar: 10,
  paraBirimi: "TRY",
  profil: "TICARIFATURA",
});

describe("e-Fatura önbelleği kullanıcıya bağlıdır", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    listEFaturalar.mockReset();
    clearEFaturaCaches();
  });
  afterEach(() => {
    clearEFaturaCaches();
    vi.unstubAllGlobals();
  });

  it("çıkışta bellek ve tarayıcı önbelleği silinir", async () => {
    setEFaturaCacheOwner("user-a");
    listEFaturalar.mockResolvedValueOnce({ faturalar: [fatura("a1")] });
    await fetchDonemFaturalar("gelen", 0);
    expect(readPersistedDonem("gelen", 0)?.data.faturalar[0]?.ettn).toBe("a1");
    expect(localStorage.length).toBe(1);

    clearEFaturaCaches();
    expect(localStorage.length).toBe(0);

    setEFaturaCacheOwner("user-b");
    expect(readPersistedDonem("gelen", 0)).toBeNull();
    listEFaturalar.mockResolvedValueOnce({ faturalar: [fatura("b1")] });
    const res = await fetchDonemFaturalar("gelen", 0);
    expect(res.faturalar.map((f) => f.ettn)).toEqual(["b1"]);
    expect(listEFaturalar).toHaveBeenCalledTimes(2);
  });

  it("başka kullanıcıya geçişte önceki kullanıcının sonucu görünmez", async () => {
    setEFaturaCacheOwner("user-a");
    listEFaturalar.mockResolvedValueOnce({ faturalar: [fatura("a1")] });
    await fetchDonemFaturalar("giden", 0);

    setEFaturaCacheOwner("user-b");
    expect(readPersistedDonem("giden", 0)).toBeNull();
  });

  it("aynı kullanıcı yeniden açınca kayıtlı sonuç korunur", async () => {
    setEFaturaCacheOwner("user-a");
    listEFaturalar.mockResolvedValueOnce({ faturalar: [fatura("a1")] });
    await fetchDonemFaturalar("gelen", 0);
    localStorage.setItem("efatura-donem:v1:gelen:2026-01-01", "{}"); // kullanıcıya bağlı olmayan eski kayıt
    // Sayfa yenilendi: modül (bellek) sıfırlanır, oturum sahibi yeniden ayarlanır
    vi.resetModules();
    const fresh = await import("./efatura");
    fresh.setEFaturaCacheOwner("user-a");
    expect(fresh.readPersistedDonem("gelen", 0)?.data.faturalar[0]?.ettn).toBe("a1");
    expect(localStorage.getItem("efatura-donem:v1:gelen:2026-01-01")).toBeNull();
    fresh.setEFaturaCacheOwner("user-b");
    expect(fresh.readPersistedDonem("gelen", 0)).toBeNull();
  });

  it("çıkıştan önce başlayan isteğin sonucu önbelleğe yazılmaz", async () => {
    setEFaturaCacheOwner("user-a");
    let resolve!: (v: { faturalar: EFatura[] }) => void;
    listEFaturalar.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const p = fetchDonemFaturalar("gelen", 0);
    clearEFaturaCaches();
    setEFaturaCacheOwner("user-b");
    resolve({ faturalar: [fatura("a1")] });
    await p;
    expect(readPersistedDonem("gelen", 0)).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
