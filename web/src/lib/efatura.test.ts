import { describe, expect, it } from "vitest";
import {
  donemCacheKey,
  getMonthBounds,
  sortEFaturaList,
  type EFatura,
} from "./efatura";

const sampleList: EFatura[] = [
  {
    ettn: "e1",
    belgeNo: "G1",
    tarih: "2026-10-05",
    unvan: "Migros Ticaret A.Ş.",
    vkn: "111",
    tutar: 1750,
    kdv: 350,
    paraBirimi: "TRY",
    profil: "TICARIFATURA",
    tip: "SATIS",
  },
  {
    ettn: "e2",
    belgeNo: "G2",
    tarih: "2026-10-28",
    unvan: "Amazon Turkey",
    vkn: "222",
    tutar: 10500,
    kdv: 2100,
    paraBirimi: "TRY",
    profil: "TICARIFATURA",
    tip: "SATIS",
  },
  {
    ettn: "e3",
    belgeNo: "G3",
    tarih: "2026-10-28",
    unvan: "Şok Marketler",
    vkn: "333",
    tutar: 150,
    kdv: undefined,
    paraBirimi: "TRY",
    profil: "TEMELFATURA",
    tip: "IADE",
  },
  {
    ettn: "e4",
    belgeNo: "G4",
    tarih: "2026-10-01",
    unvan: "İkea Mobilya",
    vkn: "444",
    tutar: 5000,
    kdv: 1000,
    paraBirimi: "TRY",
    profil: "EARSIVFATURA",
    tur: "earsiv",
  },
];

describe("efatura web helpers", () => {
  it("getMonthBounds doğru başlangıç ve bitiş tarihlerini üretir", () => {
    const bounds = getMonthBounds(0);
    expect(bounds.baslangic).toMatch(/^\d{4}-\d{2}-01$/);
    expect(bounds.bitis).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bounds.fileTag).toMatch(/^\d{4}-\d{2}$/);
    expect(bounds.label).toBeTruthy();
  });

  it("donemCacheKey yön ve tarihi birleştirir", () => {
    expect(donemCacheKey("gelen", "2026-10-01")).toBe("gelen:2026-10-01");
    expect(donemCacheKey("giden", "2026-09-01")).toBe("giden:2026-09-01");
  });

  it("sortEFaturaList: Tarih sıralaması (desc & asc)", () => {
    const desc = sortEFaturaList(sampleList, { column: "tarih", dir: "desc" });
    expect(desc.map((x) => x.belgeNo)).toEqual(["G3", "G2", "G1", "G4"]);

    const asc = sortEFaturaList(sampleList, { column: "tarih", dir: "asc" });
    expect(asc.map((x) => x.belgeNo)).toEqual(["G4", "G1", "G2", "G3"]);
  });

  it("sortEFaturaList: Firma / Ünvan sıralaması (asc & desc Türkçe)", () => {
    const asc = sortEFaturaList(sampleList, { column: "unvan", dir: "asc" });
    expect(asc.map((x) => x.belgeNo)).toEqual(["G2", "G4", "G1", "G3"]);

    const desc = sortEFaturaList(sampleList, { column: "unvan", dir: "desc" });
    expect(desc.map((x) => x.belgeNo)).toEqual(["G3", "G1", "G4", "G2"]);
  });

  it("sortEFaturaList: Toplam Tutar sıralaması (desc & asc)", () => {
    const desc = sortEFaturaList(sampleList, { column: "tutar", dir: "desc" });
    expect(desc.map((x) => x.belgeNo)).toEqual(["G2", "G4", "G1", "G3"]);

    const asc = sortEFaturaList(sampleList, { column: "tutar", dir: "asc" });
    expect(asc.map((x) => x.belgeNo)).toEqual(["G3", "G1", "G4", "G2"]);
  });

  it("sortEFaturaList: KDV sıralaması (desc & asc, tanımsız KDV sona)", () => {
    const desc = sortEFaturaList(sampleList, { column: "kdv", dir: "desc" });
    expect(desc.map((x) => x.belgeNo)).toEqual(["G2", "G4", "G1", "G3"]);

    const asc = sortEFaturaList(sampleList, { column: "kdv", dir: "asc" });
    expect(asc.map((x) => x.belgeNo)).toEqual(["G1", "G4", "G2", "G3"]);
  });

  it("sortEFaturaList: Tür / Tip sıralaması (asc & desc)", () => {
    const asc = sortEFaturaList(sampleList, { column: "tip", dir: "asc" });
    expect(asc[0]?.tur === "earsiv" || asc[0]?.tip === "IADE").toBe(true);
  });
});
