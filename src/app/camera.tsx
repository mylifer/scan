import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  type GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { colors } from '../lib/theme';

const FOCUS_RING = 72;

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [autofocus, setAutofocus] = useState<'on' | 'off'>('on');
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusAnim = useRef(new Animated.Value(0)).current;

  if (!permission) {
    return <View style={styles.black} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { paddingTop: insets.top }]}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Kamera izni gerekli</Text>
        <Text style={styles.permissionText}>Fişlerinizi okuyabilmek için kameraya erişmemiz gerekiyor.</Text>
        <PrimaryButton title="İzin ver" onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
        <PrimaryButton title="Vazgeç" variant="secondary" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  // Dokunarak netleme: iOS'ta autofocus'u kapatıp açmak yeniden odaklamayı tetikler;
  // Android'de kamera zaten sürekli otomatik odaklama yapar.
  function handleTapToFocus(e: GestureResponderEvent) {
    const { locationX: x, locationY: y } = e.nativeEvent;
    setFocusPoint({ x, y });
    focusAnim.setValue(0);
    Animated.sequence([
      Animated.spring(focusAnim, { toValue: 1, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(focusAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setFocusPoint(null));
    setAutofocus('off');
    setTimeout(() => setAutofocus('on'), 50);
  }

  async function takePicture() {
    if (!cameraRef.current || capturing || !ready) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
      router.replace({ pathname: '/review', params: { uri: photo.uri, width: String(photo.width) } });
    } catch (e) {
      setCapturing(false);
      console.warn('Fotoğraf çekilemedi', e);
    }
  }

  return (
    <View style={styles.black}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus={autofocus}
        enableTorch={torch}
        onCameraReady={() => setReady(true)}
      />

      <Pressable style={StyleSheet.absoluteFill} onPress={handleTapToFocus}>
        <View style={styles.guideWrap} pointerEvents="none">
          <View style={styles.guide}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.hint}>Fişi çerçeveye hizalayın · Netlemek için dokunun</Text>
        </View>

        {focusPoint && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusRing,
              {
                left: focusPoint.x - FOCUS_RING / 2,
                top: focusPoint.y - FOCUS_RING / 2,
                opacity: focusAnim,
                transform: [{ scale: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1.4, 1] }) }],
              },
            ]}
          />
        )}
      </Pressable>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <RoundButton label="✕" onPress={() => router.back()} />
        <RoundButton label={torch ? '🔦' : '💡'} active={torch} onPress={() => setTorch((t) => !t)} />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={takePicture}
          disabled={!ready || capturing}
          style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}>
          {capturing ? <ActivityIndicator color={colors.primary} /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
    </View>
  );
}

function RoundButton({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.round, active && { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
      <Text style={[styles.roundText, active && { color: '#000' }]}>{label}</Text>
    </Pressable>
  );
}

const CORNER = 28;
const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: colors.bg,
  },
  permissionIcon: { fontSize: 56 },
  permissionTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  permissionText: { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 12 },
  guideWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guide: { width: '78%', aspectRatio: 0.55 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  hint: {
    color: '#fff',
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  focusRing: {
    position: 'absolute',
    width: FOCUS_RING,
    height: FOCUS_RING,
    borderRadius: FOCUS_RING / 2,
    borderWidth: 2,
    borderColor: '#FACC15',
  },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, borderColor: '#000' },
});
