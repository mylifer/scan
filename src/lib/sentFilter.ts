import type { ReceiptRecord } from '../types/receipt';
import { gonderimAyi } from './kdvAy';

/**
 * Muhasebe gönderim filtresi (mobil Tüm Fişler ve web Fişler ortak):
 * 'all' hepsi, 'unsent' bekleyenler, 'sent' tüm gönderilenler, 'YYYY-MM' o ay gönderilenler.
 */
export type SentFilter = 'all' | 'unsent' | 'sent' | `${number}-${number}`;

type SentFields = Pick<ReceiptRecord, 'muhasebe_gonderildi_at'>;

/** Gönderim ayı grubu: "Kasım 2026'da gönderilenler · 12 fiş" */
export interface SentMonthGroup {
  /** YYYY-MM (Türkiye saatiyle gönderim ayı) */
  key: string;
  /** "Kasım 2026" */
  label: string;
  count: number;
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

/** "2026-11" → "Kasım 2026" */
export function sentMonthLabel(ay: string): string {
  const m = AYLAR[Number(ay.slice(5, 7)) - 1];
  return m ? `${m} ${ay.slice(0, 4)}` : ay;
}

export function matchesSentFilter(r: SentFields, filter: SentFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unsent') return !r.muhasebe_gonderildi_at;
  if (filter === 'sent') return !!r.muhasebe_gonderildi_at;
  return gonderimAyi(r) === filter;
}

/** Fişlerin gönderildiği aylar, yeniden eskiye. */
export function sentMonthGroups(rows: readonly SentFields[]): SentMonthGroup[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const ay = gonderimAyi(r);
    if (ay) counts.set(ay, (counts.get(ay) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, count]) => ({ key, label: sentMonthLabel(key), count }));
}

/** Filtrenin kısa adı: "Tümü", "Bekleyenler", "Gönderilenler", "Kasım 2026'da gönderilenler" */
export function sentFilterLabel(filter: SentFilter): string {
  if (filter === 'all') return 'Tümü';
  if (filter === 'unsent') return 'Bekleyenler';
  if (filter === 'sent') return 'Gönderilenler';
  return `${sentMonthLabel(filter)} gönderilenler`;
}

/** Gönderim tarihi, Türkiye saatiyle: "3 Kas 2026" */
export function sentDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  try {
    return d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
