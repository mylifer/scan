import { Platform } from 'react-native';

import type { Theme } from './theme';
import { fontFamily } from './theme';

/** iPad'de liste ekranlarının en geniş hâli (Ayarlar uygulamasına yakın) */
export const CONTENT_MAX_WIDTH = 760;

/** Kamera gibi tam ekran sayfalarda genişlik sınırı olmaz */
export const fullBleedContent = { contentStyle: { backgroundColor: '#000' } };

/**
 * iOS: buzlu cam, yarı saydam gezinme çubuğu (ScrollView'larda
 * contentInsetAdjustmentBehavior="automatic" gerekir). Web: düz arka plan.
 */
export function stackScreenOptions(theme: Theme) {
  const common = {
    headerTintColor: theme.blue,
    headerTitleStyle: { color: theme.label, fontFamily },
    headerBackButtonDisplayMode: 'minimal' as const,
    // iPad ve geniş tarayıcı penceresinde içerik ortada, okunabilir genişlikte (telefonda etkisiz)
    contentStyle: { backgroundColor: theme.background, width: '100%' as const, maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' as const },
  };
  if (Platform.OS === 'ios') {
    return {
      ...common,
      headerTransparent: true,
      headerBlurEffect: theme.dark ? ('systemChromeMaterialDark' as const) : ('systemChromeMaterialLight' as const),
      headerLargeStyle: { backgroundColor: theme.background },
      headerLargeTitleShadowVisible: false,
    };
  }
  return {
    ...common,
    headerStyle: { backgroundColor: theme.background },
    headerShadowVisible: false,
  };
}

export const largeTitle = Platform.OS === 'ios' ? { headerLargeTitleEnabled: true } : {};

/**
 * iOS: ilk açılmayan sekmelerin kök sayfalarında saydam büyük başlık, içeriği başlığın çok altına
 * itiyordu (üstte büyük boşluk). Bu sayfalarda başlık çubuğu düz (saydam değil); içerik hemen altından başlar.
 */
export function tabRootHeader(theme: Theme) {
  if (Platform.OS !== 'ios') return largeTitle;
  return {
    ...largeTitle,
    headerTransparent: false,
    headerBlurEffect: 'none' as const,
    headerStyle: { backgroundColor: theme.background },
    headerShadowVisible: false,
  };
}
