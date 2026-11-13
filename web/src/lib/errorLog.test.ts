import { describe, expect, it, vi } from "vitest";
import { type AppErrorRecord, reportError, shouldIgnoreError } from "./errorLog";

const insert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: null }>>(async () => ({ error: null }));
const session = { current: { user: { id: "u" } } as unknown };
vi.mock("./supabase", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: session.current } }) },
    from: () => ({ insert }),
  },
}));

const bekle = () => new Promise((r) => setTimeout(r, 0));

describe("errorLog interface", () => {
  it("tanımlı hata kaydı yapısını doğrular", () => {
    const err: AppErrorRecord = {
      id: 1,
      created_at: "2026-10-30T10:00:00Z",
      context: "test",
      message: "Hata mesajı",
      detail: "Stack trace...",
      app_version: "Web 0.5.0",
      platform: "web",
    };
    expect(err.id).toBe(1);
    expect(err.context).toBe("test");
  });
});

describe("web hata kaydı", () => {
  it("internet, eski sürüm parçası ve eklenti hataları kaydedilmez", () => {
    expect(shouldIgnoreError(new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldIgnoreError(new Error("Loading chunk 123 failed."))).toBe(true);
    expect(shouldIgnoreError(new Error("ResizeObserver loop completed with undelivered notifications."))).toBe(true);
    const eklenti = new Error("x");
    eklenti.stack = "Error: x\n    at chrome-extension://abc/content.js:1:1";
    expect(shouldIgnoreError(eklenti)).toBe(true);
    expect(shouldIgnoreError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("aynı hata bir kez yazılır, oturum yoksa yazılmaz", async () => {
    insert.mockClear();
    reportError("test", new Error("patladı"));
    await bekle();
    reportError("test", new Error("patladı"));
    await bekle();
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0]![0];
    expect(row.context).toBe("test");
    expect(row.message).toBe("patladı");
    expect(String(row.app_version)).toMatch(/^web /);

    session.current = null;
    reportError("test", new Error("başka"));
    await bekle();
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
