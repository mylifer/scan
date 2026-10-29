import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Icon } from '../components/ui/Icon';
import { parseGibQr } from '../lib/gibQr';
import { haptics } from '../lib/haptics';
import { setPendingQr } from '../lib/pendingQr';
import { type as t, useTheme } from '../lib/theme';

/** e-Arşiv / e-Fatura karekodunu okur; bulunca forma döner (Elle Fiş Ekle). */
export default function QrScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [hint, setHint] = useState<string | null>(null);
  const done = useRef(false);
  const lastBad = useRef('');

  function onScanned(result: BarcodeScanningResult) {
    if (done.current) return;
    const data = parseGibQr(result.data);
    if (!data) {
      // Aynı yanlış karekod için uyarı tekrar tekrar titretmesin
      if (lastBad.current !== result.data) {
        lastBad.current = result.data;
        haptics.error();
        setHint('Bu bir e-Fatura / e-Arşiv karekodu değil. Faturanın üzerindeki karekodu gösterin.');
      }
      return;
    }
    done.current = true;
    haptics.success();
    setPendingQr(data);
    router.back();
  }

  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <EmptyState
          icon={{ sf: 'qrcode.viewfinder', ion: 'qr-code' }}
          title="Kamera İzni Gerekli"
          message={
            permission.canAskAgain
              ? 'Faturadaki karekodu okuyabilmek için kameraya erişim izni verin.'
              : 'Kamera izni daha önce reddedildi. Ayarlar’dan bu uygulama için Kamera iznini açın.'
          }
        />
        <View style={{ gap: 8, paddingHorizontal: 20 }}>
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

  return (
    <View style={styles.black}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
      <View style={[styles.frame, { borderColor: 'rgba(255,255,255,0.9)' }]} pointerEvents="none" />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Kapat" style={styles.close}>
          <Icon sf="xmark" ion="close" size={18} color="#fff" weight="semibold" />
        </Pressable>
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={[t.headline, styles.text]}>Faturadaki karekodu çerçeveye getirin</Text>
        <Text style={[t.subhead, styles.text, { opacity: 0.85 }]}>
          {hint ?? 'e-Arşiv ve e-Fatura çıktılarındaki karekod; tutar, KDV, tarih, fatura no ve VKN hatasız okunur.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  permission: { flex: 1, justifyContent: 'center' },
  frame: { position: 'absolute', alignSelf: 'center', top: '30%', width: 240, height: 240, borderWidth: 3, borderRadius: 24 },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 24, right: 24, bottom: 0, gap: 6 },
  text: { color: '#fff', textAlign: 'center' },
});
