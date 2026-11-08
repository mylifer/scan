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
