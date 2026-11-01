import { describe, expect, it } from "vitest";
import { canAutoReload, isChunkLoadError, isNewVersion } from "./appVersion";

describe("appVersion", () => {
  it("isChunkLoadError: tarayıcıların parça yükleme hatalarını tanır", () => {
    const e = new Error("Loading chunk 123 failed.");
    e.name = "ChunkLoadError";
    expect(isChunkLoadError(e)).toBe(true);
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/_next/a.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError("Loading CSS chunk 7 failed")).toBe(true);
  });

  it("isChunkLoadError: sıradan hataları yenileme sebebi saymaz", () => {
    expect(isChunkLoadError(new Error("Faturalar yüklenemedi."))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it("canAutoReload: koruma süresi içinde ikinci yenilemeye izin vermez", () => {
    expect(canAutoReload(null, 1_000)).toBe(true);
    expect(canAutoReload(1_000, 5_000, 30_000)).toBe(false);
    expect(canAutoReload(1_000, 40_000, 30_000)).toBe(true);
    expect(canAutoReload(Number.NaN, 1_000)).toBe(true);
  });

  it("isNewVersion: yalnızca bilinen ve farklı commit için true", () => {
    expect(isNewVersion("abc", { commit: "def" })).toBe(true);
    expect(isNewVersion("abc", { commit: "abc" })).toBe(false);
    expect(isNewVersion("", { commit: "def" })).toBe(false);
    expect(isNewVersion("abc", null)).toBe(false);
    expect(isNewVersion("abc", { commit: "" })).toBe(false);
  });
});
