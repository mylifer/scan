import { monthRange } from './format';

/** Aylık/yıllık görünümde offset 0 = bu ay/yıl, -1 = bir önceki; ya da tüm zamanlar. */
export type Period = { mode: 'month'; offset: number } | { mode: 'year'; offset: number } | { mode: 'all' };

export type PeriodRange = { from: string; to: string; label: string; fileTag: string };

export function yearRange(offset = 0, now = new Date()): PeriodRange {
  const y = now.getFullYear() + offset;
  return { from: `${y}-01-01`, to: `${y + 1}-01-01`, label: `${y} yılı`, fileTag: String(y) };
}

/** Dönemin tarih aralığı; tüm zamanlar için undefined. */
export function periodRange(period: Period, now = new Date()): PeriodRange | undefined {
  if (period.mode === 'year') return yearRange(period.offset, now);
  if (period.mode === 'month') {
    const r = monthRange(period.offset, now);
    return { ...r, fileTag: r.from.slice(0, 7) };
  }
  return undefined;
}

export function periodLabel(period: Period, now = new Date()): string {
  return periodRange(period, now)?.label ?? 'Tüm zamanlar';
}

/** Görünüm değişince seçili zamanı koru: 2025 yılındayken "Aylık"a geçince 2025 Aralık, bu yıldaysa bu ay. */
export function switchMode(p: Period, mode: Period['mode'], now = new Date()): Period {
  if (p.mode === mode) return p;
  if (mode === 'all') return { mode: 'all' };
  if (mode === 'month') return { mode, offset: p.mode === 'year' && p.offset < 0 ? p.offset * 12 + 11 - now.getMonth() : 0 };
  return { mode, offset: p.mode === 'month' ? Math.floor((now.getMonth() + p.offset) / 12) : 0 };
}

export function stepPeriod(p: Period, delta: number): Period {
  return p.mode === 'all' ? p : { ...p, offset: Math.min(0, p.offset + delta) };
}
