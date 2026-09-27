import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { type as t, useTheme } from '../lib/theme';

/** Fiş fotoğrafı kartı; dokununca büyür/küçülür. */
export function ReceiptPhoto({ uri }: { uri: string | null }) {
  const theme = useTheme();
  const [zoom, setZoom] = useState(false);
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        setZoom((z) => !z);
      }}
      style={[styles.card, { height: zoom ? 460 : 190, backgroundColor: theme.dark ? '#111' : '#E5E5EA' }]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} /> : <ActivityIndicator />}
      <View style={styles.hint}>
        <Text style={[t.caption1, { color: '#fff', fontWeight: '600' }]}>{zoom ? 'Küçült' : 'Büyüt'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 28, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  hint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
