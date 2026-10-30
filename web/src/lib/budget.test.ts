import { describe, expect, it } from "vitest";
import { getMonthlyBudget, setMonthlyBudget } from "./budget";

describe("budget helper", () => {
  it("bütçe değerini kaydeder ve geri okur", () => {
    setMonthlyBudget(45000);
    expect(getMonthlyBudget()).toBe(45000);

    setMonthlyBudget(null);
    expect(getMonthlyBudget()).toBeNull();
  });
});
