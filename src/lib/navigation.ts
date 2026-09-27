import { Platform } from 'react-native';

import type { Theme } from './theme';
import { fontFamily } from './theme';

/**
 * iOS: buzlu cam, yarı saydam gezinme çubuğu (ScrollView'larda
 * contentInsetAdjustmentBehavior="automatic" gerekir). Web: düz arka plan.
 */
export function stackScreenOptions(theme: Theme) {
  const common = {
    headerTintColor: theme.blue,
    headerTitleStyle: { color: theme.label, fontFamily },
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: theme.background },
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
