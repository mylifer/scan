import { Platform, type TextStyle, useColorScheme } from 'react-native';

import { type HazirKategori, type Kategori, KATEGORI_ETIKETLERI as L } from '../types/receipt';
import { categoryLabel, isBuiltinCategory } from './categories';

/** iOS sistem renkleri (UIKit semantic colors), açık ve koyu mod. */
const light = {
  dark: false,
  background: '#F2F2F7', // systemGroupedBackground
  card: '#FFFFFF', // secondarySystemGroupedBackground
  cardElevated: '#F2F2F7', // tertiarySystemGroupedBackground
  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.6)',
  tertiaryLabel: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.29)',
  fill: 'rgba(120,120,128,0.2)',
  tertiaryFill: 'rgba(118,118,128,0.12)',
  highlight: '#D1D1D6', // satır basılı durumu
  blue: '#007AFF',
  green: '#34C759',
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  purple: '#AF52DE',
  indigo: '#5856D6',
  teal: '#30B0C7',
  pink: '#FF2D55',
  brown: '#A2845E',
  mint: '#00C7BE',
  cyan: '#32ADE6',
  gray: '#8E8E93',
  // Grafik renkleri (dataviz doğrulayıcısından geçti: açık zeminde #FFFFFF)
  chartBase: '#007AFF',
  chartKdv: '#34C759',
};

const dark: typeof light = {
  dark: true,
  background: '#000000',
  card: '#1C1C1E',
  cardElevated: '#2C2C2E',
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235,235,245,0.6)',
  tertiaryLabel: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.6)',
  fill: 'rgba(120,120,128,0.36)',
  tertiaryFill: 'rgba(118,118,128,0.24)',
  highlight: '#3A3A3C',
  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  purple: '#BF5AF2',
  indigo: '#5E5CE6',
  teal: '#40C8E0',
  pink: '#FF375F',
  brown: '#AC8E68',
  mint: '#63E6E2',
  cyan: '#64D2FF',
  gray: '#8E8E93',
  // Koyu zeminde (#1C1C1E) açıklık bandına uyması için iOS yeşilinden bir ton koyu
  chartBase: '#0A84FF',
  chartKdv: '#22A947',
};

export type Theme = typeof light;

/** Shadcn zinc renk paleti ve tasarım belirteçleri */
export const shadcnTokens = {
  light: {
    background: '#fafafa',
    foreground: '#09090b',
    card: '#ffffff',
    cardForeground: '#09090b',
    popover: '#ffffff',
    popoverForeground: '#09090b',
    primary: '#18181b',
    primaryForeground: '#fafafa',
    secondary: '#f4f4f5',
    secondaryForeground: '#18181b',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    accent: '#f4f4f5',
    accentForeground: '#18181b',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#e4e4e7',
    input: '#e4e4e7',
    ring: '#18181b',
    radius: 8,
  },
  dark: {
    background: '#09090b',
    foreground: '#fafafa',
    card: '#09090b',
    cardForeground: '#fafafa',
    popover: '#09090b',
    popoverForeground: '#fafafa',
    primary: '#fafafa',
    primaryForeground: '#18181b',
    secondary: '#27272a',
    secondaryForeground: '#fafafa',
    muted: '#27272a',
    mutedForeground: '#a1a1aa',
    accent: '#27272a',
    accentForeground: '#fafafa',
    destructive: '#ef4444',
    destructiveForeground: '#fafafa',
    border: '#27272a',
    input: '#27272a',
    ring: '#d4d4d8',
    radius: 8,
  },
};

export type ShadcnTheme = typeof shadcnTokens.light;

export function useShadcnTheme(): ShadcnTheme {
  const isDark = useColorScheme() === 'dark';
  return isDark ? shadcnTokens.dark : shadcnTokens.light;
}

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

/** iOS Dynamic Type "Large" (varsayılan) boyutları. */
export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
} satisfies Record<string, TextStyle>;

/** Tutarlarda rakamlar hizalı dursun */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Web ve sistem genelinde Geist font ailesi */
export const fontFamily = Platform.select({
  web: 'var(--font-geist-sans), "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

export interface SymbolSpec {
  /** SF Symbol adı (iOS) */
  sf: string;
  /** Ionicons adı (web/Android yedeği) */
  ion: string;
}

export type CategoryMeta = SymbolSpec & { color: keyof Theme; label: string };

const BUILTIN_META: Record<HazirKategori, CategoryMeta> = {
  akaryakıt: { sf: 'fuelpump.fill', ion: 'speedometer', color: 'orange', label: L['akaryakıt'] },
  restoran: { sf: 'fork.knife', ion: 'restaurant', color: 'pink', label: L['restoran'] },
  market: { sf: 'cart.fill', ion: 'cart', color: 'green', label: L['market'] },
  teknoloji: { sf: 'laptopcomputer', ion: 'laptop', color: 'indigo', label: L['teknoloji'] },
  'ofis gideri': { sf: 'paperclip', ion: 'attach', color: 'teal', label: L['ofis gideri'] },
  ulaşım: { sf: 'bus.fill', ion: 'bus', color: 'blue', label: L['ulaşım'] },
  'araç bakım': { sf: 'wrench.and.screwdriver.fill', ion: 'construct', color: 'brown', label: L['araç bakım'] },
  konaklama: { sf: 'bed.double.fill', ion: 'bed', color: 'purple', label: L['konaklama'] },
  iletişim: { sf: 'phone.fill', ion: 'call', color: 'cyan', label: L['iletişim'] },
  faturalar: { sf: 'bolt.fill', ion: 'flash', color: 'yellow', label: L['faturalar'] },
  kargo: { sf: 'shippingbox.fill', ion: 'cube', color: 'mint', label: L['kargo'] },
  giyim: { sf: 'tshirt.fill', ion: 'shirt', color: 'red', label: L['giyim'] },
  sağlık: { sf: 'cross.case.fill', ion: 'medkit', color: 'red', label: L['sağlık'] },
  eğitim: { sf: 'graduationcap.fill', ion: 'school', color: 'indigo', label: L['eğitim'] },
  kira: { sf: 'house.fill', ion: 'home', color: 'brown', label: L['kira'] },
  sigorta: { sf: 'shield.fill', ion: 'shield-checkmark', color: 'teal', label: L['sigorta'] },
  abonelik: { sf: 'repeat.circle.fill', ion: 'repeat', color: 'purple', label: L['abonelik'] },
  reklam: { sf: 'megaphone.fill', ion: 'megaphone', color: 'orange', label: L['reklam'] },
  'vergi ve harç': { sf: 'building.columns.fill', ion: 'library', color: 'gray', label: L['vergi ve harç'] },
  'banka masrafı': { sf: 'creditcard.fill', ion: 'card', color: 'green', label: L['banka masrafı'] },
  'yapı market': { sf: 'hammer.fill', ion: 'hammer', color: 'yellow', label: L['yapı market'] },
  'kişisel bakım': { sf: 'scissors', ion: 'cut', color: 'pink', label: L['kişisel bakım'] },
  hediye: { sf: 'gift.fill', ion: 'gift', color: 'red', label: L['hediye'] },
  eğlence: { sf: 'ticket.fill', ion: 'ticket', color: 'cyan', label: L['eğlence'] },
  diğer: { sf: 'ellipsis', ion: 'ellipsis-horizontal', color: 'gray', label: L['diğer'] },
};

/** Kullanıcının kendi kategorilerine adından türetilen sabit renk */
const CUSTOM_COLORS: (keyof Theme)[] = ['blue', 'green', 'orange', 'purple', 'pink', 'teal', 'indigo', 'brown', 'cyan', 'mint', 'red'];

/** Kategorinin simgesi, rengi ve görünen adı (kullanıcının kendi kategorisinde etiket simgesi) */
export function categoryMeta(k: Kategori): CategoryMeta {
  if (isBuiltinCategory(k)) return BUILTIN_META[k];
  let hash = 0;
  for (const ch of k) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return { sf: 'tag.fill', ion: 'pricetag', color: CUSTOM_COLORS[Math.abs(hash) % CUSTOM_COLORS.length], label: categoryLabel(k) };
}
