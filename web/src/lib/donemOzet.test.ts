import { describe, expect, it } from "vitest";
import type { EFatura } from "@shared/services/efatura/qnbEfatura";
import { donemOzetiHesapla } from "./donemOzet";

const fatura = (o: Partial<EFatura> & Pick<EFatura, "ettn">): EFatura => ({
  belgeNo: o.ettn.toUpperCase(),
  tarih: "2026-10-10",
  unvan: "Alıcı",
  vkn: "1",
  tutar: 120,
  kdv: 20,
  matrah: 100,
  paraBirimi: "TRY",
  profil: "TICARIFATURA",
  ...o,
});

describe("donemOzetiHesapla", () => {
  it("giden e-Arşiv faturalarını satışa ikinci kez eklemez", () => {
    const list = [
      fatura({ ettn: "s1", tip: "SATIS" }),
      fatura({ ettn: "s2", tip: "SATIS" }),
      fatura({ ettn: "a1", tur: "earsiv", profil: "EARSIVFATURA", tip: "SATIS" }),
      fatura({ ettn: "a2", tur: "earsiv", profil: "EARSIVFATURA" }),
    ];
    const o = donemOzetiHesapla(list, "giden");
    expect(o.satis.adet).toBe(2);
    expect(o.earsiv.adet).toBe(2);
    expect(o.satis.kdv + o.earsiv.kdv).toBe(80);
    expect(o.satis.matrah + o.earsiv.matrah).toBe(400);
    expect(o.satis.tutar + o.earsiv.tutar).toBe(480);
  });

  it("iptal ve taslak giden faturaları toplamlara katmaz, iadeyi ayırır", () => {
    const list = [
      fatura({ ettn: "s1", tip: "SATIS" }),
      fatura({ ettn: "s2", tip: "SATIS", iptal: true }),
      fatura({ ettn: "s3", tip: "SATIS", taslak: true }),
      fatura({ ettn: "i1", tip: "IADE", tutar: 60, kdv: 10, matrah: 50 }),
      fatura({ ettn: "a1", tur: "earsiv", iptal: true }),
    ];
    const o = donemOzetiHesapla(list, "giden");
    expect(o.satis.adet).toBe(1);
    expect(o.iade).toMatchObject({ adet: 1, kdv: 10 });
    expect(o.earsiv.adet).toBe(0);
  });

  it("gelen yönde tüm faturalar gelen grubunda toplanır", () => {
    const o = donemOzetiHesapla([fatura({ ettn: "g1" }), fatura({ ettn: "g2" })], "gelen");
    expect(o.gelen).toMatchObject({ adet: 2, kdv: 40, tutar: 240 });
    expect(o.satis.adet + o.earsiv.adet).toBe(0);
  });
});
