const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

export function formatTL(value: number): string {
  return tl.format(Number.isFinite(value) ? value : 0);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * "1.234,56", "1234.56", "1,234.56", "₺ 45,00" gibi girdileri sayıya çevirir.
 * Geçersiz girdide 0 döner.
 */
export function parseAmount(input: unknown): number {
  if (typeof input === 'number') return Number.isFinite(input) ? round2(input) : 0;
  if (typeof input !== 'string') return 0;
  let s = input.replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // Türk formatı: nokta binlik, virgül ondalık
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma !== -1) {
    // İngiliz formatı: virgül binlik
    s = s.replace(/,/g, '');
  } else if (lastComma === -1 && (s.match(/\./g) ?? []).length > 1) {
    // "1.234.567" → hepsi binlik
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Tutarı form alanında göstermek için: 1234.5 → "1234,50" */
export function amountToInput(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

const TR_DATE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/;

/** "5.3.24" / "05/03/2024" → "05.03.2024"; tanınmazsa null. */
export function normalizeTrDate(input: string): string | null {
  const m = input.trim().match(TR_DATE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return `${pad(day)}.${pad(month)}.${year}`;
}

/** "05.03.2024" → "2024-03-05"; geçersizse null. */
export function trDateToIso(input: string): string | null {
  const normalized = normalizeTrDate(input);
  if (!normalized) return null;
  const [d, m, y] = normalized.split('.');
  return `${y}-${m}-${d}`;
}

/** "2024-03-05" → "05.03.2024" */
export function isoToTrDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function todayTr(): string {
  const now = new Date();
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
}

/** Bu ayın [ilk gün, sonraki ayın ilk günü) aralığı, YYYY-MM-DD */
export function currentMonthRange(now = new Date()): { from: string; to: string; label: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const next = new Date(y, m + 1, 1);
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`,
    label: now.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
