import { useRef } from 'react';

import { useTheme } from '../lib/theme';
import { ListRow, ListSection } from './ui/List';

export interface PickedPhoto {
  uri: string;
  width: number;
}

interface Props {
  onPicked: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}

/** Web (iPhone Safari): "Fotoğraf Çek" her dokunuşta kamerayı açar; "Galeriden Seç" çoklu seçim yaptırır. */
export function AddPhotoButtons({ onPicked, disabled }: Props) {
  const theme = useTheme();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handle(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    input.value = ''; // aynı dosyayı tekrar seçebilmek için
    if (!files.length) return;
    onPicked(
      await Promise.all(
        files.map(async (f) => {
          const uri = URL.createObjectURL(f);
          return { uri, width: await imageWidth(uri) };
        }),
      ),
    );
  }

  return (
    <>
      <ListSection footer="Her fotoğraf anında taslak olarak kaydedilir; uygulamayı kapatsanız da kaybolmaz.">
        <ListRow
          title="Fotoğraf Çek"
          icon={{ sf: 'camera.fill', ion: 'camera', color: theme.blue }}
          onPress={() => cameraRef.current?.click()}
          disabled={disabled}
          chevron
        />
        <ListRow
          title="Galeriden Seç"
          icon={{ sf: 'photo.on.rectangle.angled', ion: 'images', color: theme.green }}
          onPress={() => galleryRef.current?.click()}
          disabled={disabled}
          chevron
        />
      </ListSection>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handle(e.currentTarget)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => handle(e.currentTarget)} />
    </>
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
