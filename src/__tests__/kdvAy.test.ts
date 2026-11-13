import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { EFatura } from '../../supabase/functions/qnb-efatura/soap';
import { ayEkle, devredenEtiketi, devredenFisAylari, fisAyaAitMi, fisKdvAyi, kdvAyHesapla, kdvFisFiltresi } from '../lib/kdvAy';
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

  it('devredenEtiketi aynı yıl için sade, farklı yıl için yılı belirterek üretir', () => {
    assert.equal(devredenEtiketi('2026-01', '2026-12'), 'Ocak Devreden KDV');
    assert.equal(devredenEtiketi('2026-03', '2026-12'), 'Mart Devreden KDV');
    assert.equal(devredenEtiketi('2025-12', '2026-01'), 'Aralık 2025 Devreden KDV');
    assert.equal(devredenEtiketi('2026-01', '2027-01'), 'Ocak 2026 Devreden KDV');
  });
});

const gonderilmis = (f: ReceiptRecord, at: string) => {
  f.muhasebe_gonderildi_at = at;
  return f;
};

describe('Fişin KDV dönemi (gönderim ayı − 1)', () => {
  it('ayEkle yıl geçişlerini doğru yapar', () => {
    assert.equal(ayEkle('2027-01', -1), '2026-12');
    assert.equal(ayEkle('2026-12', 1), '2027-01');
    assert.equal(ayEkle('2026-11', -13), '2025-10');
  });

  it('gönderilen fiş gönderim ayından bir önceki aya, gönderilmeyen bulunulan aydan bir önceki aya düşer', () => {
    const simdi = '2026-11';
    // Kasım'da gönderilen Ekim fişi → Ekim
    assert.equal(fisKdvAyi(gonderilmis(fis('a', '2026-10-20', 0, 0), '2026-11-02T10:00:00Z'), simdi), '2026-10');
    // Ekim'de gönderilen Ağustos fişi → Eylül (Ekim gönderimi Eylül dönemini kapsar)
    assert.equal(fisKdvAyi(gonderilmis(fis('b', '2026-08-15', 0, 0), '2026-10-05T10:00:00Z'), simdi), '2026-09');
    // Gönderilmemiş Eylül fişi, Kasım'dayken → Ekim
    assert.equal(fisKdvAyi(fis('c', '2026-09-10', 0, 0), simdi), '2026-10');
    // Gönderilmemiş Kasım fişi → Kasım (fiş tarihinden önceki aya düşülemez)
    assert.equal(fisKdvAyi(fis('d', '2026-11-03', 0, 0), simdi), '2026-11');
    // Kasım'da gönderilen Kasım fişi → Kasım
    assert.equal(fisKdvAyi(gonderilmis(fis('e', '2026-11-01', 0, 0), '2026-11-05T10:00:00Z'), simdi), '2026-11');
    // Türkiye saatiyle 1 Kasım 00:30 (UTC 31 Ekim 21:30) gönderim Kasım sayılır → Ekim dönemi
    assert.equal(fisKdvAyi(gonderilmis(fis('f', '2026-09-01', 0, 0), '2026-10-31T21:30:00Z'), simdi), '2026-10');
  });

  it('kullanıcı senaryosu: Kasım\'dayız, son gönderim Ekim\'de yapıldı', () => {
    const simdi = '2026-11';
    const tum = [
      gonderilmis(fis('agustos-ekimde-gonderildi', '2026-08-15', 1000, 200), '2026-10-05T10:00:00Z'),
      gonderilmis(fis('ekim-kasimda-gonderildi', '2026-10-20', 500, 100), '2026-11-02T10:00:00Z'),
      fis('ekim-bekleyen', '2026-10-22', 250, 50),
      fis('eylul-bekleyen', '2026-09-10', 300, 60),
      fis('kasim-bekleyen', '2026-11-03', 400, 80),
      gonderilmis(fis('kasim-kasimda-gonderildi', '2026-11-01', 150, 30), '2026-11-05T10:00:00Z'),
    ];

    // Eylül: yalnızca Ekim'de gönderilen Ağustos fişi (devreden Ağustos kalemi)
    const eylul = kdvAyHesapla([], [], tum, new Set(), '2026-09', simdi);
    assert.equal(eylul.fis.adet, 1);
    assert.equal(eylul.fis.kdv, 200);
    assert.equal(eylul.fis.devredenler?.[0]?.etiket, 'Ağustos Devreden KDV');

    // Ekim: Kasım'da gönderilen Ekim fişi + gönderilmemiş Ekim ve Eylül fişleri
    const ekim = kdvAyHesapla([], [], tum, new Set(), '2026-10', simdi);
    assert.equal(ekim.fis.adet, 3);
    assert.equal(ekim.fis.kdv, 210);
    assert.equal(ekim.fis.buAyKdv, 150);
    assert.equal(ekim.fis.devredenKdv, 60);
    assert.equal(ekim.fis.devredenler?.[0]?.etiket, 'Eylül Devreden KDV');

    // Kasım: yalnızca Kasım tarihli fişler
    const kasim = kdvAyHesapla([], [], tum, new Set(), '2026-11', simdi);
    assert.equal(kasim.fis.adet, 2);
    assert.equal(kasim.fis.kdv, 110);
  });

  it('araya gönderim girmese de gönderilmeyen fişler bulunulan aydan bir önceki aya düşer', () => {
    const tum = [
      gonderilmis(fis('haziran', '2026-06-10', 0, 10), '2026-08-03T10:00:00Z'), // Temmuz dönemi
      fis('temmuz-bekleyen', '2026-07-12', 0, 20),
    ];
    assert.equal(kdvAyHesapla([], [], tum, new Set(), '2026-07', '2026-11').fis.kdv, 10);
    assert.equal(kdvAyHesapla([], [], tum, new Set(), '2026-08', '2026-11').fis.kdv, 0);
    assert.equal(kdvAyHesapla([], [], tum, new Set(), '2026-10', '2026-11').fis.kdv, 20);
  });

  it('yıl geçişinde Ocak\'tayken gönderilmeyen Aralık fişi Aralık\'tan, Ocak fişi Ocak\'tan düşer', () => {
    const tum = [fis('aralik', '2026-12-20', 0, 40), fis('ocak', '2027-01-05', 0, 15), fis('mart', '2026-03-01', 0, 5)];
    const aralik = kdvAyHesapla([], [], tum, new Set(), '2026-12', '2027-01');
    assert.equal(aralik.fis.kdv, 45);
    assert.equal(aralik.fis.devredenler?.[0]?.etiket, 'Mart Devreden KDV');
    assert.equal(kdvAyHesapla([], [], tum, new Set(), '2027-01', '2027-01').fis.kdv, 15);
  });

  it('fisAyaAitMi tarihsiz fişi hiçbir aya katmaz', () => {
    assert.equal(fisAyaAitMi(fis('x', '', 0, 0), '2026-10', '2026-11'), false);
  });

  it('kdvFisFiltresi: hedef ay, sonraki ayın gönderimleri ve (bulunulan ay − 1 ise) bekleyenler', () => {
    const ekim = kdvFisFiltresi('2026-10', '2026-11');
    assert.ok(ekim.includes('and(tarih.gte.2026-10-01,tarih.lt.2026-11-01)'));
    assert.ok(ekim.includes('muhasebe_gonderildi_at.gte.2026-11-01T00:00:00+03:00,muhasebe_gonderildi_at.lt.2026-12-01T00:00:00+03:00'));
    assert.ok(ekim.includes('and(muhasebe_gonderildi_at.is.null,tarih.lt.2026-11-01)'));
    const eylul = kdvFisFiltresi('2026-09', '2026-11');
    assert.ok(!eylul.includes('is.null'));
    const aralik = kdvFisFiltresi('2026-12', '2027-01');
    assert.ok(aralik.includes('muhasebe_gonderildi_at.lt.2027-02-01T00:00:00+03:00'));
    assert.ok(aralik.includes('is.null,tarih.lt.2027-01-01'));
  });
});

describe('Devreden fişin e-Faturasıyla eşleşmesi', () => {
  // Eylül tarihli fiş Kasım'da gönderildi → Ekim KDV'sine girer; aynı alışverişin e-Faturası Eylül'de sayıldı
  const gecFis = gonderilmis(fis('gec', '2026-09-15', 1200, 200, '1111111111'), '2026-11-03T10:00:00+03:00');
  const eylulFaturasi = fatura('eylul', 1200, 200, { tarih: '2026-09-15' });

  it('devredenFisAylari hedef aydan eski fişlerin aylarını verir', () => {
    const ekimFisi = gonderilmis(fis('e', '2026-10-05', 100, 10), '2026-11-03T10:00:00+03:00');
    assert.deepEqual(devredenFisAylari([gecFis, ekimFisi], '2026-10', '2026-11'), ['2026-09']);
    assert.deepEqual(devredenFisAylari([gecFis], '2026-10', '2026-11', 0), []);
  });

  it('önceki ayın faturası verilmezse fiş sayılır (eski davranış)', () => {
    const k = kdvAyHesapla([], [], [gecFis], new Set(), '2026-10', '2026-11');
    assert.equal(k.fis.kdv, 200);
  });

  it('önceki ayın faturasıyla eşleşen devreden fiş iki kez sayılmaz, o faturanın KDV\'si bu aya eklenmez', () => {
    const k = kdvAyHesapla([], [], [gecFis], new Set(), '2026-10', '2026-11', [eylulFaturasi]);
    assert.equal(k.fis.eslesen, 1);
    assert.equal(k.fis.kdv, 0);
    assert.equal(k.gelenEfatura.kdv, 0);
    assert.equal(k.dusulebilir, 0);
  });

  it('önceki aydaki iptal edilmiş fatura eşleşmeye katılmaz', () => {
    const iptal = fatura('eylul', 1200, 200, { tarih: '2026-09-15', iptal: true });
    const k = kdvAyHesapla([], [], [gecFis], new Set(), '2026-10', '2026-11', [iptal]);
    assert.equal(k.fis.eslesen, 0);
  });
});
