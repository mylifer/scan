import { Platform, type TextStyle, useColorScheme } from 'react-native';

import { type Kategori, KATEGORI_ETIKETLERI as L } from '../types/receipt';

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

/** Web'de SF Pro yoksa en yakın sistem yazı tipi */
export const fontFamily = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

export interface SymbolSpec {
  /** SF Symbol adı (iOS) */
  sf: string;
  /** Ionicons adı (web/Android yedeği) */
  ion: string;
}

export const categoryMeta: Record<Kategori, SymbolSpec & { color: keyof Theme; label: string }> = {
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
  diğer: { sf: 'ellipsis', ion: 'ellipsis-horizontal', color: 'gray', label: L['diğer'] },
};
