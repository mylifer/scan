import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type as t } from '../lib/theme';
import { Icon } from './ui/Icon';

const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Tam ekran fotoğraf görüntüleyici (Fotoğraflar uygulaması gibi):
 * iki parmakla yakınlaştır, sürükleyerek gez, çift dokunarak yakınlaştır/sıfırla.
 */
export function PhotoViewer({ uri, visible, onClose }: { uri: string | null; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value < 1.05) reset();
      else savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  function close() {
    // Bir sonraki açılışta sıfırdan başlasın
    for (const v of [scale, savedScale]) v.set(1);
    for (const v of [tx, ty, savedTx, savedTy]) v.set(0);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={close} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[StyleSheet.absoluteFill, style]}>
            {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />}
          </Animated.View>
        </GestureDetector>

        <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable onPress={close} accessibilityLabel="Kapat" hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <BlurView intensity={40} tint="dark" style={styles.close}>
              <Icon sf="xmark" ion="close" size={16} color="#fff" weight="semibold" />
            </BlurView>
          </Pressable>
        </View>
        <View style={[styles.hint, { bottom: insets.bottom + 20 }]} pointerEvents="none">
          <Text style={[t.footnote, { color: 'rgba(255,255,255,0.8)' }]}>İki parmakla yakınlaştırın · çift dokunun</Text>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', right: 16, left: 16, alignItems: 'flex-end' },
  close: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
