import { describe, expect, it } from "vitest";
import { type AppErrorRecord } from "./errorLog";

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
