import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { daysUntil, formatTrDate, nextBusinessDay, taxDeadlines } from '../lib/taxCalendar';

// Beklenen değerler bağımsız bir Python hesabıyla (iki tatil kaynağının birleşimi) doğrulandı
const find = (kind: string, period: string) => {
  const d = taxDeadlines('2026-01-01', '2027-12-31').find((x) => x.kind === kind && x.period === period);
  assert.ok(d, `${kind} ${period} bulunamadı`);
  return d;
};

describe('vergi takvimi', () => {
  it('KDV: izleyen ayın 28i; hafta sonu/bayramda ilk iş gününe kayar', () => {
    assert.equal(find('kdv', 'Mart 2026').date, '2026-04-28');
    assert.equal(find('kdv', 'Nisan 2026').date, '2026-06-01'); // 28 Mayıs Kurban Bayramı, 30-31 hafta sonu
    assert.equal(find('kdv', 'Şubat 2027').date, '2027-03-29'); // 28 Mart Pazar
    assert.equal(find('kdv', 'Temmuz 2027').date, '2027-08-31'); // 28 Cmt, 30 Ağustos Zafer Bayramı
    assert.equal(find('kdv', 'Aralık 2026').date, '2027-01-28');
  });

  it('geçici vergi: 17 Mayıs / 17 Ağustos / 17 Kasım (4. dönem yok)', () => {
    assert.equal(find('gecici', '2026 1. dönem (Ocak–Mart)').date, '2026-05-18'); // 17 Mayıs Pazar
    assert.equal(find('gecici', '2026 2. dönem (Nisan–Haziran)').date, '2026-08-17');
    assert.equal(find('gecici', '2026 3. dönem (Temmuz–Eylül)').date, '2026-11-17');
    assert.equal(find('gecici', '2027 1. dönem (Ocak–Mart)').date, '2027-05-20'); // 16-19 Mayıs Kurban
    const all = taxDeadlines('2026-01-01', '2027-12-31').filter((d) => d.kind === 'gecici');
    assert.equal(all.length, 6);
  });

  it('yıllık gelir vergisi: 31 Mart beyan, 31 Temmuz 2. taksit', () => {
    assert.equal(find('yillik', '2026 yılı').date, '2027-03-31');
    assert.equal(find('yillik-taksit', '2026 yılı').date, '2027-08-02'); // 31 Temmuz Cumartesi
  });

  it('yarım gün tatil (arife, 28 Ekim) süreyi kaydırmaz ama not düşülür', () => {
    const eylul = find('kdv', 'Eylül 2026');
    assert.equal(eylul.date, '2026-10-28');
    assert.ok(eylul.notes.some((n) => n.includes('yarım gün')));
    const muhtasar = find('muhtasar', 'Nisan 2026');
    assert.equal(muhtasar.date, '2026-05-26'); // Kurban arifesi
    assert.ok(muhtasar.notes.some((n) => n.includes('yarım gün')));
  });

  it('kayan son günler için açıklama ve doğrulanmamış yıl uyarısı', () => {
    const n = find('kdv', 'Nisan 2026');
    assert.equal(n.legalDate, '2026-05-28');
    assert.match(n.notes[0]!, /ilk iş gününe kaydı/);
    const later = taxDeadlines('2028-01-01', '2028-12-31');
    assert.ok(later.every((d) => d.notes.some((x) => x.includes('doğrulanmadı'))));
  });

  it('yardımcılar', () => {
    assert.equal(nextBusinessDay('2026-10-29'), '2026-10-30'); // Cumhuriyet Bayramı → Cuma
    assert.equal(formatTrDate('2026-06-01'), '1 Haziran 2026 Pazartesi');
    assert.equal(daysUntil('2026-10-28', '2026-10-25'), 3);
    const list = taxDeadlines('2026-10-01', '2026-12-31');
    assert.deepEqual([...list].sort((a, b) => a.date.localeCompare(b.date)), list, 'tarihe göre sıralı');
  });
});

describe('vergi hatırlatma planı', () => {
  it('3 gün önce 10:00 ve son gün 09:00; geçmiştekiler yok; sadece ana yükümlülükler', async () => {
    const { planTaxReminders, localDate } = await import('../lib/taxReminderPlan');
    const plan = planTaxReminders(new Date(2026, 9, 25, 12, 0)); // 25 Ekim 2026 12:00
    // Eylül KDV son günü 28 Ekim: 25 Ekim 10:00 geçti, son gün bildirimi kaldı
    assert.ok(!plan.some((r) => r.id === 'tax-kdv-2026-10-28-before'));
    const due = plan.find((r) => r.id === 'tax-kdv-2026-10-28-due');
    assert.ok(due);
    assert.equal(localDate(due).getTime(), new Date(2026, 9, 28, 9, 0).getTime());
    const gecici = plan.find((r) => r.id === 'tax-gecici-2026-11-17-before');
    assert.equal(gecici?.day, '2026-11-14');
    assert.ok(!plan.some((r) => r.id.includes('muhtasar') || r.id.includes('babs')));
    assert.equal(new Set(plan.map((r) => r.id)).size, plan.length, 'kimlikler benzersiz');
    assert.ok(plan.length < 40, 'iOS 64 bildirim sınırının altında');
    // Kayan son gün (Nisan 2026 KDV → 1 Haziran) bildirimi kaymış güne göre
    const may = planTaxReminders(new Date(2026, 4, 1, 8, 0)).find((r) => r.id.startsWith('tax-kdv-2026-06-01'));
    assert.ok(may);
  });
});
