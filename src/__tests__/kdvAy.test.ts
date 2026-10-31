import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EFatura } from '../../supabase/functions/qnb-efatura/soap';
import { devredenEtiketi, fisAyaAitMi, kdvAyHesapla } from '../lib/kdvAy';
import type { ReceiptRecord } from '../types/receipt';

const fatura = (ettn: string, tutar: number, kdv: number | undefined, extra: Partial<EFatura> = {}): EFatura => ({
  ettn,
  belgeNo: ettn,
  tarih: '2026-10-10',
  unvan: 'Firma',
  vkn: '1111111111',
  tutar,
  paraBirimi: 'TRY',
  profil: 'TEMELFATURA',
  ...(kdv === undefined ? {} : { kdv }),
  ...extra,
});

const fis = (id: string, tarih: string, toplam: number, kdv: number, vkn: string | null = null) =>
  ({ id, tarih, toplam_tutar: toplam, toplam_kdv: kdv, vkn }) as unknown as ReceiptRecord;

describe('Aylık KDV', () => {
  it('Ekim 2026 örneği: tevkifat düşülür, kestiğim iade düşülebilirden çıkar, olağan dışı hariç', () => {
    const giden = [
      fatura('s1', 145530, 29400, { tevkifat: 8820, tip: 'TEVKIFAT' }),
      fatura('i1', 9893.99, 899.45, { tip: 'IADE' }),
      fatura('x', 144000000, 24000000, { tip: 'SATIS' }),
      fatura('t', 100, 20, { taslak: true }),
    ];
    const gelen = [fatura('g1', 1200, 200), fatura('g2', 120, 20), fatura('g3', 50, undefined)];
    const k = kdvAyHesapla(gelen, giden, [], new Set(['x']));
    assert.deepEqual(k.kestigim, { faturada: 29400, tevkifat: 8820, beyan: 20580, adet: 1 });
    assert.deepEqual(k.iade, { kdv: 899.45, adet: 1 });
    assert.deepEqual(k.gelenEfatura, { kdv: 220, adet: 3, eksik: 1 });
    assert.equal(k.dusulebilir, -679.45); // 220 − 899,45
    assert.equal(k.sonuc, 21259.45);
  });

  it('e-Faturayla aynı alışveriş olan fiş iki kez sayılmaz', () => {
    const gelen = [fatura('g1', 1753.14, 160, { tarih: '2026-10-02', vkn: '6220529513' })];
    const fisler = [
      fis('a', '2026-10-02', 1753.14, 160, '6220529513'), // aynı alışveriş
      fis('b', '2026-10-02', 1753.1, 160, null), // ±5 kuruş ama e-Fatura zaten eşleşti
      fis('c', '2026-10-05', 300, 50),
    ];
    const k = kdvAyHesapla(gelen, [], fisler);
    assert.deepEqual(k.fis, { kdv: 210, adet: 2, eslesen: 1 });
    assert.equal(k.dusulebilir, 370);
  });

  it('düşülebilir fazlaysa sonuç negatif (devreden)', () => {
    const k = kdvAyHesapla([fatura('g', 600, 100)], [fatura('s', 60, 10)], []);
    assert.equal(k.sonuc, -90);
  });

  it('farklı VKN eşleşmez', () => {
    const k = kdvAyHesapla([fatura('g', 100, 18, { vkn: '1' })], [], [fis('a', '2026-10-10', 100, 18, '2')]);
    assert.equal(k.fis.eslesen, 0);
    assert.equal(k.dusulebilir, 36);
  });

  it('muhasebeciye gönderilmiş fişler yalnızca gönderildiği ayın KDV hesabına katılır', () => {
    // Fiş 1: Fiş tarihi Ağustos 2026, ama Ekim 2026'da muhasebeciye gönderildi
    const agustosFisi = fis('f1', '2026-08-15', 1000, 200);
    agustosFisi.muhasebe_gonderildi_at = '2026-10-05T10:00:00.000Z';

    // Fiş 2: Fiş tarihi Ekim 2026, ama Kasım 2026'da muhasebeciye gönderildi
    const ekimFisiKasimdaGonderilen = fis('f2', '2026-10-20', 500, 100);
    ekimFisiKasimdaGonderilen.muhasebe_gonderildi_at = '2026-11-02T10:00:00.000Z';

    // Fiş 3: Fiş tarihi Ekim 2026, henüz gönderilmedi (muhasebe_gonderildi_at = null)
    const ekimFisiBekleyen = fis('f3', '2026-10-22', 250, 50);

    const tumFisler = [agustosFisi, ekimFisiKasimdaGonderilen, ekimFisiBekleyen];

    // 1) Ağustos 2026 KDV hesabı:
    // Ağustos fişi Ekim'de gönderildiği için Ağustos KDV'sine KATILMAMALI
    const agustosKdv = kdvAyHesapla([], [], tumFisler, new Set(), '2026-08', '2026-10');
    assert.equal(agustosKdv.fis.adet, 0);
    assert.equal(agustosKdv.fis.kdv, 0);

    // 2) Ekim 2026 KDV hesabı (mevcut ay Ekim):
    // - agustosFisi: Ekim'de gönderildiği için Ekim KDV'sine DAHİL (+200 KDV, devreden)
    // - ekimFisiBekleyen: Ekim fişi ve henüz gönderilmediği için Ekim KDV'sine DAHİL (+50 KDV, bu ay)
    // - ekimFisiKasimdaGonderilen: Kasım'da gönderildiği için Ekim KDV'sine KATILMAMALI
    const ekimKdv = kdvAyHesapla([], [], tumFisler, new Set(), '2026-10', '2026-10');
    assert.equal(ekimKdv.fis.adet, 2);
    assert.equal(ekimKdv.fis.kdv, 250);

    // 3) Kasım 2026 KDV hesabı (mevcut ay Ekim iken Kasım'a bakılırsa):
    // - ekimFisiKasimdaGonderilen: Kasım'da gönderildiği için Kasım KDV'sine DAHİL (+100 KDV)
    // - agustosFisi: Ekim'de gönderildiği için Kasım KDV'sine KATILMAMALI
    // - ekimFisiBekleyen: Ekim fişi ve mevcut ay Ekim olduğundan henüz Kasım'a devretmedi
    const kasimKdv = kdvAyHesapla([], [], tumFisler, new Set(), '2026-11', '2026-10');
    assert.equal(kasimKdv.fis.adet, 1);
    assert.equal(kasimKdv.fis.kdv, 100);
  });

  it('devredenEtiketi aynı yıl için sade, farklı yıl için yılı belirterek üretir', () => {
    assert.equal(devredenEtiketi('2026-01', '2026-12'), 'Ocak Devreden KDV');
    assert.equal(devredenEtiketi('2026-03', '2026-12'), 'Mart Devreden KDV');
    assert.equal(devredenEtiketi('2025-12', '2026-01'), 'Aralık 2025 Devreden KDV');
    assert.equal(devredenEtiketi('2026-01', '2027-01'), 'Ocak 2026 Devreden KDV');
  });

  it('gönderilmeyen fişler mevcut bulunulan ayda düşürülür ve devreden KDV olarak ayrı kalem görünür', () => {
    // Kullanıcının senaryosu:
    // Aralık ayındayım (2026-12) ve aynı yılın Ocak ayına ait bir fiş giriş yaptım (200 TL KDV).
    const ocakFisi = fis('f_ocak', '2026-01-15', 1200, 200);
    // Ayrıca Mart ayına ait 150 TL KDV'lik bir fiş daha olsun
    const martFisi = fis('f_mart', '2026-03-20', 900, 150);
    // Ve bu ayın (Aralık) kendi fişi (400 TL KDV)
    const aralikFisi = fis('f_aralik', '2026-12-05', 2400, 400);

    const tumFisler = [ocakFisi, martFisi, aralikFisi];

    // 1) Mevcut ay Aralık 2026 iken Aralık KDV hesabı:
    const aralikKdv = kdvAyHesapla([], [], tumFisler, new Set(), '2026-12', '2026-12');

    // Toplam fiş KDV: 400 + 200 + 150 = 750 TL, toplam 3 adet
    assert.equal(aralikKdv.fis.kdv, 750);
    assert.equal(aralikKdv.fis.adet, 3);
    assert.equal(aralikKdv.dusulebilir, 750);

    // Bu ayın fişleri: 400 TL, 1 adet
    assert.equal(aralikKdv.fis.buAyKdv, 400);
    assert.equal(aralikKdv.fis.buAyAdet, 1);

    // Devreden KDV toplamı: 350 TL, 2 adet
    assert.equal(aralikKdv.fis.devredenKdv, 350);
    assert.equal(aralikKdv.fis.devredenAdet, 2);

    // Devreden kalemler dökümü:
    assert.ok(aralikKdv.fis.devredenler);
    assert.equal(aralikKdv.fis.devredenler.length, 2);
    assert.deepEqual(aralikKdv.fis.devredenler[0], {
      ay: '2026-01',
      ayAdi: 'Ocak',
      etiket: 'Ocak Devreden KDV',
      kdv: 200,
      adet: 1,
    });
    assert.deepEqual(aralikKdv.fis.devredenler[1], {
      ay: '2026-03',
      ayAdi: 'Mart',
      etiket: 'Mart Devreden KDV',
      kdv: 150,
      adet: 1,
    });

    // 2) Aralık'ta muhasebeciye gönderilmezse:
    // Mevcut ay Ocak 2027 olduğunda (simdikiAy = '2027-01'):
    // Bu fişler Ocak 2027'ye devreder!
    const ocak2027Kdv = kdvAyHesapla([], [], tumFisler, new Set(), '2027-01', '2027-01');
    assert.equal(ocak2027Kdv.fis.kdv, 750);
    assert.equal(ocak2027Kdv.fis.adet, 3);
    assert.equal(ocak2027Kdv.fis.buAyKdv, 0);
    assert.equal(ocak2027Kdv.fis.buAyAdet, 0);
    assert.equal(ocak2027Kdv.fis.devredenKdv, 750);
    assert.equal(ocak2027Kdv.fis.devredenler?.length, 3);
    assert.equal(ocak2027Kdv.fis.devredenler?.[0]?.etiket, 'Ocak 2026 Devreden KDV');
    assert.equal(ocak2027Kdv.fis.devredenler?.[1]?.etiket, 'Mart 2026 Devreden KDV');
    assert.equal(ocak2027Kdv.fis.devredenler?.[2]?.etiket, 'Aralık 2026 Devreden KDV');

    // Mevcut ay Ocak 2027 iken geçmiş Aralık 2026'ya bakıldığında:
    // Gönderilmeyen fişler Ocak 2027'ye devretmiş olduğu için geçmiş Aralık'ta 0 görünür:
    const gecmisAralikKdv = kdvAyHesapla([], [], tumFisler, new Set(), '2026-12', '2027-01');
    assert.equal(gecmisAralikKdv.fis.adet, 0);
    assert.equal(gecmisAralikKdv.fis.kdv, 0);

    // 3) Eğer Aralık 2026'da bu fişler muhasebeciye gönderilmiş olarak işaretlenseydi:
    ocakFisi.muhasebe_gonderildi_at = '2026-12-25T10:00:00.000Z';
    aralikFisi.muhasebe_gonderildi_at = '2026-12-25T10:00:00.000Z';
    // martFisi ise henüz gönderilmedi (null)

    // Şimdi Ocak 2027'de hesaplayalım:
    const ocak2027GonderilmisSonrasi = kdvAyHesapla([], [], tumFisler, new Set(), '2027-01', '2027-01');
    // Yalnızca gönderilmeyen martFisi devreder:
    assert.equal(ocak2027GonderilmisSonrasi.fis.kdv, 150);
    assert.equal(ocak2027GonderilmisSonrasi.fis.adet, 1);
    assert.equal(ocak2027GonderilmisSonrasi.fis.devredenler?.[0]?.etiket, 'Mart 2026 Devreden KDV');

    // Gönderilmiş olan fişler ise Aralık 2026'da sabit kalır:
    const aralikGonderilmisSonrasi = kdvAyHesapla([], [], tumFisler, new Set(), '2026-12', '2027-01');
    assert.equal(aralikGonderilmisSonrasi.fis.adet, 2);
    assert.equal(aralikGonderilmisSonrasi.fis.kdv, 600); // 200 + 400
  });
});
