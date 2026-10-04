import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, type GestureResponderEvent, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { haptics } from '../lib/haptics';
import { type SymbolSpec, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { subscribeDraftStatus } from '../services/drafts/draftProcessor';
import { enqueueDraftUpload } from '../services/drafts/uploadQueue';

const FOCUS_BOX = 76;

type ShotStatus = 'uploading' | 'reading' | 'ready' | 'failed';
interface Shot {
  key: number;
  uri: string;
  draftId?: string;
  status: ShotStatus;
}

/**
 * Fiş kamerası. Varsayılan (hızlı çekim): her fotoğraf arka planda yüklenip hemen yapay zekâyla okunur,
 * kamera açık kalır; "İncele" okunanları sırayla kontrol ettirir. Toplu mod (?mode=batch): yalnızca
 * taslağa ekler, okuma Toplu Tarama ekranından (şimdi ya da planlı) başlatılır.
 */
export default function CameraScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const batch = useLocalSearchParams<{ mode?: string }>().mode === 'batch';
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [autofocus, setAutofocus] = useState<'on' | 'off'>('on');
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const nextKey = useRef(0);

  // Hızlı çekimde taslakların okuma durumunu izle
  useEffect(
    () =>
      subscribeDraftStatus((id, status) =>
        setShots((list) => list.map((s) => (s.draftId === id ? { ...s, status: status === 'processing' ? 'reading' : status } : s))),
      ),
    [],
  );
  const [focusAnim] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <EmptyState
          icon={{ sf: 'camera.fill', ion: 'camera' }}
          title="Kamera İzni Gerekli"
          message={
            permission.canAskAgain
              ? 'Fişlerinizi okuyabilmek için kameraya erişim izni verin.'
              : 'Kamera izni daha önce reddedildi. Ayarlar\'dan bu uygulama için Kamera iznini açın.'
          }
        />
        <View style={{ gap: 8, paddingHorizontal: 20 }}>
          {/* iOS izni bir kez reddedilince sistem penceresini bir daha göstermez; tek yol Ayarlar */}
          {permission.canAskAgain ? (
            <Button title="İzin Ver" onPress={requestPermission} />
          ) : (
            <Button title="Ayarları Aç" onPress={() => Linking.openSettings()} />
          )}
          <Button title="Vazgeç" variant="plain" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  // Dokunarak netleme: iOS'ta autofocus'u kapatıp açmak yeniden odaklamayı tetikler
  function focusAt(e: GestureResponderEvent) {
    const { locationX: x, locationY: y } = e.nativeEvent;
    haptics.select();
    setFocusPoint({ x, y });
    focusAnim.setValue(0);
    Animated.sequence([
      Animated.spring(focusAnim, { toValue: 1, useNativeDriver: true, damping: 14 }),
      Animated.delay(700),
      Animated.timing(focusAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setFocusPoint(null));
    setAutofocus('off');
    setTimeout(() => setAutofocus('on'), 50);
  }

  async function takePicture() {
    if (!cameraRef.current || capturing || !ready) return;
    haptics.tap();
    setCapturing(true);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, shutterSound: false });
      // Kamerada kal: fotoğraf arka planda yüklenir (hızlı çekimde ardından hemen okunur)
      setCapturing(false);
      const key = nextKey.current++;
      setShots((s) => [...s, { key, uri: photo.uri, status: 'uploading' }]);
      enqueueDraftUpload(photo.uri, photo.width, { scan: !batch }).then((draft) => {
        if (!draft) showToast('Fotoğraf yüklenemedi; uygulama yeniden açılınca tekrar denenir', 'error');
        setShots((list) =>
          list.map((s) =>
            s.key !== key
              ? s
              : draft
                ? { ...s, draftId: draft.id, status: s.status === 'uploading' ? (batch ? 'ready' : 'reading') : s.status }
                : { ...s, status: 'failed' },
          ),
        );
      });
    } catch {
      setCapturing(false);
      haptics.error();
    }
  }

  const last = shots[shots.length - 1];
  const readyCount = shots.filter((s) => s.status === 'ready').length;
  const readingCount = shots.filter((s) => s.status === 'reading' || s.status === 'uploading').length;
  const failedCount = shots.filter((s) => s.status === 'failed').length;
  const pill = batch
    ? `Toplu çekim · ${shots.length}`
    : shots.length === 0
      ? 'Fişi çerçeveye hizalayın'
      : [`${shots.length} fiş`, readingCount && `${readingCount} okunuyor`, readyCount && `${readyCount} hazır`, failedCount && `${failedCount} okunamadı`]
          .filter(Boolean)
          .join(' · ');

  function finish() {
    if (batch || shots.length === 0) {
      router.back();
      return;
    }
    // Okunanları incele; okunmakta olanlar hazır oldukça sıraya eklenir
    router.replace('/batch-review');
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
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: flash }]} />

      <Pressable style={StyleSheet.absoluteFill} onPress={focusAt} accessibilityLabel="Netlemek için dokunun">
        <View style={styles.guideWrap} pointerEvents="none">
          <View style={styles.guide}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
              <View key={c} style={[styles.corner, styles[c]]} />
            ))}
          </View>
        </View>
        {focusPoint && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.focus,
              {
                left: focusPoint.x - FOCUS_BOX / 2,
                top: focusPoint.y - FOCUS_BOX / 2,
                opacity: focusAnim,
                transform: [{ scale: focusAnim.interpolate({ inputRange: [0, 1], outputRange: [1.5, 1] }) }],
              },
            ]}
          />
        )}
      </Pressable>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <GlassButton icon={{ sf: 'xmark', ion: 'close' }} onPress={() => router.back()} label="Kapat" />
        <View style={styles.hintPill}>
          <Text style={[t.footnote, { color: '#fff', fontWeight: '600' }]}>
            {pill}
          </Text>
        </View>
        <GlassButton
          icon={torch ? { sf: 'bolt.fill', ion: 'flash' } : { sf: 'bolt.slash.fill', ion: 'flash-off' }}
          onPress={() => {
            haptics.select();
            setTorch((v) => !v);
          }}
          active={torch}
          label="Flaş"
        />
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.side}>
          {last && (
            <View>
              <Image source={{ uri: last.uri }} style={styles.thumb} contentFit="cover" />
              {!batch && (
                <View style={[styles.badge, { backgroundColor: last.status === 'ready' ? '#30D158' : last.status === 'failed' ? '#FF453A' : 'rgba(0,0,0,0.6)' }]}>
                  {last.status === 'ready' ? (
                    <Icon sf="checkmark" ion="checkmark" size={12} color="#fff" weight="bold" />
                  ) : last.status === 'failed' ? (
                    <Icon sf="exclamationmark" ion="alert" size={12} color="#fff" weight="bold" />
                  ) : (
                    <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.6 }] }} />
                  )}
                </View>
              )}
            </View>
          )}
        </View>
        <Pressable
          onPress={takePicture}
          disabled={!ready || capturing}
          accessibilityLabel="Fotoğraf çek"
          style={({ pressed }) => [styles.shutterRing, pressed && { transform: [{ scale: 0.92 }] }]}>
          {capturing ? <ActivityIndicator color="#fff" /> : <View style={styles.shutter} />}
        </Pressable>
        <View style={styles.side}>
          {shots.length > 0 && (
            <Pressable onPress={finish} hitSlop={10} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Text style={[t.headline, { color: '#FFD60A' }]}>{batch ? 'Bitti' : 'İncele'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function GlassButton({ icon, onPress, active, label }: { icon: SymbolSpec; onPress: () => void; active?: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <BlurView intensity={40} tint="dark" style={[styles.glass, active && { backgroundColor: '#FFD60A' }]}>
        <Icon {...icon} size={17} color={active ? '#000' : '#fff'} weight="semibold" />
      </BlurView>
    </Pressable>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  permission: { flex: 1, justifyContent: 'center' },
  guideWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guide: { width: '76%', aspectRatio: 0.56 },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: 'rgba(255,255,255,0.9)' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  focus: { position: 'absolute', width: FOCUS_BOX, height: FOCUS_BOX, borderWidth: 1.5, borderColor: '#FFD60A' },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  glass: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  hintPill: { backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  side: { width: 64, alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 8, borderWidth: 1.5, borderColor: '#fff' },
  badge: { position: 'absolute', right: -6, top: -6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
});
