import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView, type SymbolWeight } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import type { SymbolSpec } from '../../lib/theme';

interface Props extends SymbolSpec {
  size?: number;
  color: ColorValue;
  weight?: SymbolWeight;
}

/** iOS'ta SF Symbol, diğer platformlarda Ionicons. */
export function Icon({ sf, ion, size = 20, color, weight = 'regular' }: Props) {
  return (
    <SymbolView
      name={{ ios: sf as never }}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      fallback={<Ionicons name={ion as never} size={size} color={color as string} />}
    />
  );
}
