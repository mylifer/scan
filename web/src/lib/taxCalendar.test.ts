import { describe, expect, it } from "vitest";
import { taxDeadlines, type TaxDeadline } from "@shared/lib/taxCalendar";
import { countPastDeadlines, filterTaxDeadlines, taxYearOptions } from "./taxCalendar";

const mockDeadlines: TaxDeadline[] = [
  {
    kind: "kdv",
    title: "KDV Beyannamesi",
    period: "Ağustos 2026",
    date: "2026-09-28",
    legalDate: "2026-09-28",
    notes: [],
    remind: true,
  },
  {
    kind: "kdv",
    title: "KDV Beyannamesi",
    period: "Eylül 2026",
    date: "2026-10-28",
    legalDate: "2026-10-28",
    notes: [],
    remind: true,
  },
  {
    kind: "muhtasar",
    title: "Muhtasar",
    period: "Eylül 2026",
    date: "2026-10-26",
    legalDate: "2026-10-26",
    notes: [],
    remind: true,
  },
  {
    kind: "gecici",
    title: "Geçici Vergi",
    period: "2026 3. dönem",
    date: "2026-11-17",
    legalDate: "2026-11-17",
    notes: [],
    remind: true,
  },
  {
    kind: "kdv",
    title: "KDV Beyannamesi",
    period: "Ekim 2026",
    date: "2026-11-30",
    legalDate: "2026-11-28",
    notes: ["Tatil kaydırması"],
    remind: true,
  },
];

describe("taxCalendar filtering", () => {
  const referenceToday = "2026-10-28"; // Bugüne eşit bir tarih seçildi (Eylül 2026 KDV günü)

  it("varsayılan olarak (showPast=false) geçmiş satırları göstermez", () => {
    const result = filterTaxDeadlines(mockDeadlines, {
      today: referenceToday,
      showPast: false,
    });

    // 2026-09-28 ve 2026-10-26 geçmiş, 2026-10-28 bugün (dahil), 11-17 ve 11-30 gelecek
    expect(result.map((d) => d.date)).toEqual([
      "2026-10-28",
      "2026-11-17",
      "2026-11-30",
    ]);
  });

  it("showPast=true olduğunda tüm geçmiş satırlar listeye dahil edilir", () => {
    const result = filterTaxDeadlines(mockDeadlines, {
      today: referenceToday,
      showPast: true,
    });

    expect(result.length).toBe(mockDeadlines.length);
  });

  it("tür filtresi ve showPast=false birlikte doğru çalışır", () => {
    const result = filterTaxDeadlines(mockDeadlines, {
      kind: "kdv",
      today: referenceToday,
      showPast: false,
    });

    // Sadece KDV ve geçmiş olmayanlar: 10-28 (bugün) ve 11-30
    expect(result.map((d) => d.date)).toEqual(["2026-10-28", "2026-11-30"]);
  });

  it("countPastDeadlines geçmiş kayıtları doğru sayar", () => {
    const totalPast = countPastDeadlines(mockDeadlines, { today: referenceToday });
    expect(totalPast).toBe(2); // 09-28 ve 10-26

    const kdvPast = countPastDeadlines(mockDeadlines, {
      kind: "kdv",
      today: referenceToday,
    });
    expect(kdvPast).toBe(1); // Yalnızca 09-28
  });
});

describe("taxYearOptions", () => {
  it("geçen yıl, bu yıl ve gelecek yılı verir; bayram verisi olmayan yılları atlar", () => {
    expect(taxYearOptions("2026-11-08")).toEqual(["2026", "2027"]);
    expect(taxYearOptions("2028-02-01")).toEqual(["2027", "2028", "2029"]);
  });

  it("takvim her seçenek yılı için son günleri üretir", () => {
    for (const y of taxYearOptions("2028-02-01")) {
      const list = taxDeadlines(`${y}-01-01`, `${y}-12-31`);
      expect(list.filter((d) => d.kind === "kdv")).toHaveLength(12);
      expect(list.every((d) => d.date.startsWith(y))).toBe(true);
    }
  });
});
