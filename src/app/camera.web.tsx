import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '../components/PrimaryButton';
import { showAlert } from '../lib/alert';
import { setPendingPhoto } from '../lib/pendingPhoto';
import { colors } from '../lib/theme';

/**
 * Web (iPhone Safari) sürümü: telefonun kendi kamera uygulamasını açar.
 * Böylece netleme, flaş ve tam çözünürlük iOS tarafından sağlanır.
 */
export default function CameraWebScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    try {
      const uri = URL.createObjectURL(file);
      const width = await imageWidth(uri);
      setPendingPhoto({ uri, width });
      router.replace('/review');
    } catch {
      setLoading(false);
      showAlert('Fotoğraf açılamadı', 'Lütfen tekrar deneyin.');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🧾</Text>
      <Text style={styles.title}>Fişi fotoğraflayın</Text>
      <Text style={styles.tips}>
        • Fişi düz bir zemine koyun{'\n'}• Tüm fiş kadraja girsin{'\n'}• Netlemek için ekrana dokunun{'\n'}• Karanlıksa
        flaşı açın
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : (
        <>
          <PrimaryButton title="📷  Kamerayı aç" onPress={() => inputRef.current?.click()} style={styles.button} />
          <PrimaryButton title="Vazgeç" variant="secondary" onPress={() => router.back()} style={styles.button} />
        </>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.currentTarget.files?.[0])}
      />
    </View>
  );
}

function imageWidth(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = reject;
    img.src = uri;
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
    backgroundColor: colors.bg,
  },
  icon: { fontSize: 64 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  tips: { fontSize: 15, lineHeight: 24, color: colors.muted, marginBottom: 12 },
  button: { alignSelf: 'stretch' },
});
