import { describe, expect, it } from "vitest";
import { buildManifest, parseManifest, planRestore } from "@shared/lib/backupFormat";
import type { ReceiptRecord } from "@shared/types/receipt";

describe("backup & restore pure logic", () => {
  it("manifest oluşturur ve geri ayrıştırır", () => {
    const receipts: ReceiptRecord[] = [
      {
        id: "r1",
        created_at: "2026-10-30T10:00:00Z",
        firma_adi: "Migros",
        tarih: "2026-10-30",
        toplam_tutar: 150.5,
        kdv_yuzde1: 0,
        kdv_yuzde10: 15.05,
        kdv_yuzde20: 0,
        toplam_kdv: 15.05,
        kategori: "market",
        image_path: "user/img.jpg",
        fis_no: null,
        vkn: null,
        notlar: null,
        muhasebe_gonderildi_at: null,
        etiketler: [],
      },
    ];

    const manifest = buildManifest(receipts, new Set(["r1"]), "2026-10-30T10:05:00Z", "Web 0.5.0");
    expect(manifest.receipts.length).toBe(1);
    expect(manifest.receipts[0].photo).toBe("fotograflar/r1.jpg");

    const json = JSON.stringify(manifest);
    const parsed = parseManifest(json);
    expect(parsed.receipts.length).toBe(1);
    expect(parsed.receipts[0].firma_adi).toBe("Migros");

    const plan = planRestore(parsed.receipts, receipts);
    expect(plan.toInsert.length).toBe(0);
    expect(plan.skipped).toBe(1);
  });
});

describe("sniffImageContentType", () => {
  it("PNG, PDF, WebP ve JPEG'i ilk baytlardan tanır", async () => {
    const { sniffImageContentType } = await import("./backup");
    expect(sniffImageContentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageContentType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffImageContentType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageContentType(new Uint8Array([]))).toBe("image/jpeg");
  });
});
