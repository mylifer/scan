import { View } from 'react-native';

import { type SymbolSpec } from '../../lib/theme';
import { Icon } from './Icon';

/** Ayarlar uygulamasındaki renkli, yuvarlatılmış kare ikon. */
export function IconTile({ sf, ion, color, size = 29 }: SymbolSpec & { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon sf={sf} ion={ion} size={size * 0.6} color="#fff" weight="semibold" />
    </View>
  );
}
