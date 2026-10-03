/**
 * Şahıs işletmesi (gerçek usul) için vergi takvimi.
 *
 * Yasal son günler:
 * - KDV beyannamesi ve ödemesi: dönemi izleyen ayın 28'i
 * - Muhtasar ve prim hizmet beyannamesi (çalışan ya da kira stopajı varsa): izleyen ayın 26'sı
 * - Ba-Bs formları: izleyen ayın son günü
 * - Geçici vergi (3 dönem): dönemi izleyen ikinci ayın 17'si → 17 Mayıs, 17 Ağustos, 17 Kasım
 * - Yıllık gelir vergisi: beyan ve 1. taksit 31 Mart, 2. taksit 31 Temmuz
 * Son gün hafta sonuna ya da tam gün resmî tatile denk gelirse, izleyen ilk iş gününe kayar (VUK 18).
 * Yarım gün tatiller (bayram arifeleri, 28 Ekim) için süre kaydırılmaz; kullanıcıya not gösterilir.
 * GİB'in ayrıca ilan ettiği süre uzatmaları öngörülemez; ekranda hatırlatılır.
 */

export type TaxKind = 'kdv' | 'muhtasar' | 'babs' | 'gecici' | 'yillik' | 'yillik-taksit';

export interface TaxDeadline {
  kind: TaxKind;
  title: string;
  /** Kapsadığı dönem, ör. "Eylül 2026", "2026 1. dönem (Ocak–Mart)" */
  period: string;
  /** Kaydırma uygulanmış son gün, YYYY-MM-DD */
  date: string;
  /** Yasal (kaydırılmamış) gün; kaydırma olduysa farklıdır */
  legalDate: string;
  /** Kullanıcıya gösterilecek notlar */
  notes: string[];
  /** Hatırlatma bildirimi gönderilsin mi (ana yükümlülükler) */
  remind: boolean;
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** Her yıl aynı olan tam gün resmî tatiller (AA-GG) */
const FIXED_HOLIDAYS = ['01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29'];

/**
 * Dini bayramlar (tam gün). İki bağımsız kaynakla (date.nager.at, python-holidays) doğrulandı.
 * 2027 Ramazan Bayramı kaynaklarda 9–11 / 10–12 Mart olarak farklı; ikisinin birleşimi alındı
 * (o aralıkta vergi son günü yok). Bu tablonun kapsamadığı yıllar için kaydırma "doğrulanmadı" sayılır.
 */
const RELIGIOUS_HOLIDAYS: Record<number, string[]> = {
  2026: ['2026-03-20', '2026-03-21', '2026-03-22', '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30'],
  2027: ['2027-03-09', '2027-03-10', '2027-03-11', '2027-03-12', '2027-05-16', '2027-05-17', '2027-05-18', '2027-05-19'],
};

/** Yarım gün tatiller: dini bayram arifeleri ve 28 Ekim (öğleden sonra) */
const HALF_DAYS: Record<number, string[]> = {
  2026: ['2026-03-19', '2026-05-26', '2026-10-28'],
  2027: ['2027-03-08', '2027-05-15', '2027-10-28'],
};

export const VERIFIED_UNTIL_YEAR = 2027;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function parse(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

/** Takvim günü (saat dilimi etkisiz, UTC üzerinden) */
function addDays(isoDate: string, days: number): string {
  const { y, m, d } = parse(isoDate);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function weekday(isoDate: string): number {
  const { y, m, d } = parse(isoDate);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Pazar … 6 Cumartesi
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isFullHoliday(isoDate: string): boolean {
  const { y } = parse(isoDate);
  return FIXED_HOLIDAYS.includes(isoDate.slice(5)) || (RELIGIOUS_HOLIDAYS[y]?.includes(isoDate) ?? false);
}

export function isHalfDay(isoDate: string): boolean {
  return HALF_DAYS[parse(isoDate).y]?.includes(isoDate) ?? false;
}

/** Hafta sonu ya da tam gün resmî tatilse izleyen ilk iş günü (VUK 18) */
export function nextBusinessDay(isoDate: string): string {
  let d = isoDate;
  while (weekday(d) === 0 || weekday(d) === 6 || isFullHoliday(d)) d = addDays(d, 1);
  return d;
}

function deadline(kind: TaxKind, title: string, period: string, legalDate: string, extraNotes: string[], remind: boolean): TaxDeadline {
  const date = nextBusinessDay(legalDate);
  const notes = [...extraNotes];
  if (date !== legalDate) {
    notes.unshift(`Yasal son gün ${formatTrDate(legalDate)} hafta sonu/resmî tatile denk geldiği için ilk iş gününe kaydı.`);
  }
  if (isHalfDay(date)) notes.push('Bu gün yarım gün tatil (arife). Süre uzatması olup olmadığını GİB duyurularından kontrol edin.');
  if (parse(legalDate).y > VERIFIED_UNTIL_YEAR || parse(date).y > VERIFIED_UNTIL_YEAR) {
    notes.push('Bu yılın bayram tarihleri henüz doğrulanmadı; tarihi GİB takviminden kontrol edin.');
  }
  return { kind, title, period, date, legalDate, notes, remind };
}

/** [from, to] aralığındaki son günler, tarihe göre sıralı (YYYY-MM-DD) */
export function taxDeadlines(from: string, to: string): TaxDeadline[] {
  const out: TaxDeadline[] = [];
  const start = parse(from);
  // Aralığı kapsayacak kadar önceki dönemlerden başla (yıllık beyan önceki yıla ait)
  for (let y = start.y - 1; y <= parse(to).y; y++) {
    for (let m = 1; m <= 12; m++) {
      // m ayının yükümlülükleri, izleyen ayda
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const period = `${AYLAR[m - 1]} ${y}`;
      out.push(deadline('kdv', 'KDV beyannamesi ve ödemesi', period, iso(ny, nm, 28), [], true));
      out.push(deadline('muhtasar', 'Muhtasar ve prim hizmet beyannamesi', period, iso(ny, nm, 26), ['Çalışanınız ya da kira stopajınız varsa.'], false));
      out.push(deadline('babs', 'Ba-Bs formları', period, iso(ny, nm, lastDayOfMonth(ny, nm)), ['Genellikle muhasebeciniz verir.'], false));
    }
    const gecici: [string, string][] = [
      ['1. dönem (Ocak–Mart)', iso(y, 5, 17)],
      ['2. dönem (Nisan–Haziran)', iso(y, 8, 17)],
      ['3. dönem (Temmuz–Eylül)', iso(y, 11, 17)],
    ];
    for (const [p, d] of gecici) out.push(deadline('gecici', 'Geçici vergi beyannamesi ve ödemesi', `${y} ${p}`, d, [], true));
    out.push(deadline('yillik', 'Yıllık gelir vergisi beyannamesi ve 1. taksit', `${y} yılı`, iso(y + 1, 3, 31), ['Beyan dönemi 1–31 Mart.'], true));
    out.push(deadline('yillik-taksit', 'Yıllık gelir vergisi 2. taksit', `${y} yılı`, iso(y + 1, 7, 31), [], true));
  }
  return out.filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
}

/** "2026-05-28" → "28 Mayıs 2026 Perşembe" */
export function formatTrDate(isoDate: string): string {
  const { y, m, d } = parse(isoDate);
  const gun = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][weekday(isoDate)];
  return `${d} ${AYLAR[m - 1]} ${y} ${gun}`;
}

/** Bugünden son güne kalan gün (bugün = 0) */
export function daysUntil(isoDate: string, today: string): number {
  const a = parse(today);
  const b = parse(isoDate);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Yerel tarihi YYYY-MM-DD yapar */
export function todayIso(now = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
