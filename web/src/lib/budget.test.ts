import { describe, expect, it, vi } from "vitest";
import { getMonthlyBudget, setMonthlyBudget } from "./budget";

describe("budget helper", () => {
  it("bütçe değerini kaydeder ve geri okur", () => {
    setMonthlyBudget(45000);
    expect(getMonthlyBudget()).toBe(45000);

    setMonthlyBudget(null);
    expect(getMonthlyBudget()).toBeNull();
  });
});

describe("bütçe kullanıcıya özel", () => {
  it("başka kullanıcı öncekinin bütçesini görmez, aynı kullanıcı geri dönünce görür", async () => {
    const { setBudgetOwner } = await import("./budget");
    const mem = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    });
    localStorage.setItem("budget:monthly", "30000");
    setBudgetOwner("a");
    expect(getMonthlyBudget()).toBe(30000);
    expect(localStorage.getItem("budget:monthly")).toBeNull();
    setBudgetOwner("b");
    expect(getMonthlyBudget()).toBeNull();
    setMonthlyBudget(12000);
    setBudgetOwner(null);
    expect(getMonthlyBudget()).toBeNull();
    setBudgetOwner("a");
    expect(getMonthlyBudget()).toBe(30000);
    setBudgetOwner("b");
    expect(getMonthlyBudget()).toBe(12000);
    vi.unstubAllGlobals();
  });
});

describe("bütçe bulutla eşitlenir", () => {
  it("girişte buluttaki değer gelir; internetsiz değişiklik bekleyen kalır ve sonra yazılır", async () => {
    vi.resetModules();
    const mod = await import("./budget");
    const mem = new Map<string, string>();
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    });
    let bulut: number | null = 42000;
    let cevrimdisi = false;
    mod.setBudgetRemote({
      oku: async () => {
        if (cevrimdisi) throw new Error("ağ");
        return { durum: "var", deger: bulut };
      },
      yaz: async (_u, d) => {
        if (cevrimdisi) throw new Error("ağ");
        bulut = d;
        return true;
      },
    });
    mem.set("budget:monthly:u", "30000");
    mod.setBudgetOwner("u");
    await mod.syncBudget(true);
    expect(mod.getMonthlyBudget()).toBe(42000);
    expect(mem.get("budget:monthly:u")).toBe("42000");

    cevrimdisi = true;
    mod.setMonthlyBudget(15000);
    await mod.syncBudget(true);
    expect(mem.get("budget:monthly:u:pending")).toBe("1");
    expect(bulut).toBe(42000);

    cevrimdisi = false;
    await mod.syncBudget(true);
    expect(bulut).toBe(15000);
    expect(mod.getMonthlyBudget()).toBe(15000);
    expect(mem.has("budget:monthly:u:pending")).toBe(false);
    mod.setBudgetRemote(null);
    vi.unstubAllGlobals();
  });
});
