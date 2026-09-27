import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { type as t, useTheme } from '../lib/theme';
import { PhotoViewer } from './PhotoViewer';
import { Icon } from './ui/Icon';

/** Fiş fotoğrafı kartı; dokununca tam ekran yakınlaştırılabilir görüntüleyici açılır. */
export function ReceiptPhoto({ uri }: { uri: string | null }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => {
          if (!uri) return;
          haptics.tap();
          setOpen(true);
        }}
        accessibilityLabel="Fotoğrafı tam ekran aç"
        style={({ pressed }) => [styles.card, { backgroundColor: theme.dark ? '#111' : '#E5E5EA', opacity: pressed ? 0.85 : 1 }]}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} /> : <ActivityIndicator />}
        <View style={styles.hint}>
          <Icon sf="arrow.up.left.and.arrow.down.right" ion="expand" size={12} color="#fff" weight="semibold" />
          <Text style={[t.caption1, { color: '#fff', fontWeight: '600' }]}>Büyüt</Text>
        </View>
      </Pressable>
      <PhotoViewer uri={uri} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: { height: 190, marginHorizontal: 16, marginBottom: 28, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  hint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
