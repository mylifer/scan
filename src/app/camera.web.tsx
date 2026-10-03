import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListRow, ListSection } from '../components/ui/List';
import { showAlert } from '../lib/alert';
import { setPendingPhoto } from '../lib/pendingPhoto';
import { useTheme } from '../lib/theme';

/**
 * Web (iPhone Safari) sürümü: telefonun kendi kamera uygulamasını açar.
 * Böylece netleme, flaş ve tam çözünürlük iOS tarafından sağlanır.
 */
export default function CameraWebScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    const uri = URL.createObjectURL(file);
    try {
      setPendingPhoto({ uri, width: await imageWidth(uri) });
      router.replace('/review');
    } catch {
      URL.revokeObjectURL(uri);
      setLoading(false);
      showAlert('Fotoğraf açılamadı', 'Lütfen tekrar deneyin.');
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
      <EmptyState icon={{ sf: 'camera.viewfinder', ion: 'scan-outline' }} title="Fişi Fotoğraflayın" message="Net bir fotoğraf, daha doğru okuma demek." />

      <ListSection header="İpuçları">
        <ListRow title="Fişi düz bir zemine koyun" icon={{ sf: 'rectangle.portrait', ion: 'document-outline', color: theme.blue }} />
        <ListRow title="Tüm fiş kadraja girsin" icon={{ sf: 'viewfinder', ion: 'expand-outline', color: theme.indigo }} />
        <ListRow title="Netlemek için ekrana dokunun" icon={{ sf: 'hand.tap.fill', ion: 'finger-print', color: theme.teal }} />
        <ListRow title="Karanlıksa flaşı açın" icon={{ sf: 'bolt.fill', ion: 'flash', color: theme.orange }} />
      </ListSection>

      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        {loading ? (
          <ActivityIndicator style={{ height: 50 }} />
        ) : (
          <>
            <Button title="Kamerayı Aç" icon={{ sf: 'camera.fill', ion: 'camera' }} onPress={() => inputRef.current?.click()} />
            <Button title="Vazgeç" variant="plain" onPress={() => router.back()} />
          </>
        )}
      </View>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = ''; // açılamayan fotoğraf tekrar seçilebilsin (aynı dosyada onChange tetiklenmez)
          handleFile(file);
        }}
      />
    </ScrollView>
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
