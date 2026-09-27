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

/**
 * Bugünden `offset` ay önceki/sonraki ayın [ilk gün, sonraki ayın ilk günü) aralığı, YYYY-MM-DD.
 * offset 0 = bu ay, -1 = geçen ay.
 */
export function monthRange(offset = 0, now = new Date()): { from: string; to: string; label: string } {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const y = start.getFullYear();
  const m = start.getMonth();
  const next = new Date(y, m + 1, 1);
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`,
    label: start.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Arşiv görselinin dosya adı: "2026-09-14_migros-ticaret-as_x7k2".
 * Tarih başta olduğu için Storage'da tarih sırasıyla dizilir; sondaki ek aynı gün
 * aynı firmadan gelen fişlerin çakışmasını önler.
 */
export function receiptImageName(isoDate: string, firmaAdi: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${isoDate}_${slugify(firmaAdi) || 'fis'}_${suffix}`;
}

const TR_ASCII: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', i̇: 'i', ö: 'o', ş: 's', ü: 'u' };

/** "MİGROS TİCARET A.Ş." → "migros-ticaret-as" (Storage anahtarları için güvenli ASCII) */
export function slugify(text: string): string {
  const slug = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[çğıöşü]|i̇/g, (ch) => TR_ASCII[ch] ?? ch)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.']/g, '') // "A.Ş." → "as"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // En fazla 40 karakter; kelimenin ortasından kesme
  return slug.length <= 40 ? slug : slug.slice(0, 41).replace(/-[^-]*$/, '');
}

/** 1536 → "2 KB", 12.3 MB → "12,3 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2).replace('.', ',')} GB`;
}
