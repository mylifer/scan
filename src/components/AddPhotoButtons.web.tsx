import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from './PrimaryButton';

export interface PickedPhoto {
  uri: string;
  width: number;
}

interface Props {
  onPicked: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}

/**
 * Web (iPhone Safari): "Fotoğraf çek" her dokunuşta telefonun kamerasını açar;
 * "Galeriden seç" birden fazla fotoğraf seçtirir.
 */
export function AddPhotoButtons({ onPicked, disabled }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handle(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = ''; // aynı dosyayı tekrar seçebilmek için
    if (!files.length) return;
    const photos = await Promise.all(
      files.map(async (f) => {
        const uri = URL.createObjectURL(f);
        return { uri, width: await imageWidth(uri) };
      }),
    );
    onPicked(photos);
  }

  return (
    <View style={styles.row}>
      <PrimaryButton
        title="📷  Fotoğraf çek"
        onPress={() => cameraRef.current?.click()}
        disabled={disabled}
        style={{ flex: 1 }}
      />
      <PrimaryButton
        title="🖼️  Galeriden"
        variant="secondary"
        onPress={() => galleryRef.current?.click()}
        disabled={disabled}
        style={{ flex: 1 }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handle(e.currentTarget)}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handle(e.currentTarget)}
      />
    </View>
  );
}

function imageWidth(uri: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(1400);
    img.src = uri;
  });
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 10 } });
