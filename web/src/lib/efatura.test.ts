import { describe, expect, it } from "vitest";
import {
  aySonuclariniBirlestir,
  donemCacheKey,
  efaturaMatcher,
  getMonthBounds,
  sortEFaturaList,
  TUMU_MAX_AY,
  TUMU_VARSAYILAN_AY,
  tumuAyAraligi,
  tryNetToplam,
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

  it("fetchAllFaturalar fonksiyonu dışa aktarılmıştır", async () => {
    const { fetchAllFaturalar } = await import("./efatura");
    expect(typeof fetchAllFaturalar).toBe("function");
  });
});

describe("Tümünü Göster (fetchAllFaturalar yardımcıları)", () => {
  const now = new Date(2026, 10, 15); // Kasım 2026

  it("tumuAyAraligi: ilk fatura ayından seçilen aya kadar", () => {
    const r = tumuAyAraligi("2026-08", 0, now);
    expect(r.offsets).toEqual([-3, -2, -1, 0]);
    expect(r.kirpildi).toBe(false);
    expect(r.ilkAyBilinmiyor).toBe(false);
  });

  it("tumuAyAraligi: çok eski ilk ay TUMU_MAX_AY ile kırpılır ve bildirilir", () => {
    const r = tumuAyAraligi("2015-01", -2, now);
    expect(r.offsets).toHaveLength(TUMU_MAX_AY);
    expect(r.offsets.at(-1)).toBe(-2);
    expect(r.kirpildi).toBe(true);
  });

  it("tumuAyAraligi: ilk ay bilinmiyorsa varsayılan ay sayısı", () => {
    const r = tumuAyAraligi(null, 0, now);
    expect(r.offsets).toHaveLength(TUMU_VARSAYILAN_AY);
    expect(r.ilkAyBilinmiyor).toBe(true);
  });

  it("aySonuclariniBirlestir: tekilleştirir, uyarıları korur, eksik ayı bildirir", () => {
    const { data, eksikAy } = aySonuclariniBirlestir([
      { label: "Eylül 2026", ok: true, data: { faturalar: [sampleList[0]!], uyari: "QNB sayısı uyuşmuyor.", kontrol: { liste: 1, qnb: 1 } } },
      { label: "Ekim 2026", ok: false, error: new Error("Oturum hatası") },
      { label: "Kasım 2026", ok: true, data: { faturalar: [sampleList[0]!, sampleList[1]!], uyari: "QNB sayısı uyuşmuyor.", kontrol: { liste: 2, qnb: 2 } } },
    ]);
    expect(eksikAy).toBe(1);
    expect(data.faturalar.map((f) => f.ettn)).toEqual(["e2", "e1"]);
    expect(data.kontrol).toEqual({ liste: 3, qnb: 3 });
    expect(data.uyari).toContain("QNB sayısı uyuşmuyor.");
    expect(data.uyari?.match(/QNB sayısı uyuşmuyor/g)).toHaveLength(1);
    expect(data.uyari).toContain("1 ay yüklenemedi (Ekim 2026)");
  });

  it("aySonuclariniBirlestir: hiçbir ay yüklenemezse hatayı fırlatır", () => {
    expect(() =>
      aySonuclariniBirlestir([
        { label: "Ekim 2026", ok: false, error: new Error("QNB bilgileri eksik") },
        { label: "Kasım 2026", ok: false, error: new Error("QNB bilgileri eksik") },
      ]),
    ).toThrow("QNB bilgileri eksik");
  });
});

describe("efaturaMatcher", () => {
  const list: EFatura[] = [
    { ...sampleList[0]!, ettn: "x1", unvan: "MİGROS TİCARET A.Ş.", belgeNo: "GIB2026000000001" },
    { ...sampleList[0]!, ettn: "x2", unvan: "Işık Elektrik", belgeNo: "ABC1", tutar: 337.3 },
  ];
  const ara = (q: string) => list.filter(efaturaMatcher(q)).map((f) => f.ettn);

  it("Türkçe büyük/küçük harften bağımsız eşleşir", () => {
    expect(ara("ticaret")).toEqual(["x1"]);
    expect(ara("TİCARET")).toEqual(["x1"]);
    expect(ara("ışık")).toEqual(["x2"]);
    expect(ara("IŞIK")).toEqual(["x2"]);
  });

  it("belge no, tutar ve boş sorgu", () => {
    expect(ara("gib2026")).toEqual(["x1"]);
    expect(ara("337.3")).toEqual(["x2"]);
    expect(ara("  ")).toEqual(["x1", "x2"]);
  });
});

describe("tryNetToplam", () => {
  it("iadeleri düşer, iptal/taslak ve döviz faturaları katmaz", () => {
    const base = sampleList[0]!;
    const list: EFatura[] = [
      { ...base, ettn: "1", tutar: 1000, tip: "SATIS" },
      { ...base, ettn: "2", tutar: 200, tip: "IADE" },
      { ...base, ettn: "3", tutar: 500, iptal: true },
      { ...base, ettn: "4", tutar: 300, taslak: true },
      { ...base, ettn: "5", tutar: 50, paraBirimi: "USD" },
    ];
    expect(tryNetToplam(list)).toBe(800);
  });
});
