import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { ListRow, ListSection } from './ui/List';

export interface PickedPhoto {
  uri: string;
  width: number;
}

interface Props {
  onPicked: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}

/** Native: "Fotoğraf Çek" kamerayı toplu modda açar; "Galeriden Seç" çoklu seçim yaptırır. */
export function AddPhotoButtons({ onPicked, disabled }: Props) {
  const theme = useTheme();

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showToast('Galeri izni verilmedi', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 1,
    });
    if (!result.canceled && result.assets.length) onPicked(result.assets.map((a) => ({ uri: a.uri, width: a.width })));
  }

  return (
    <ListSection footer="Her fotoğraf anında taslak olarak kaydedilir; uygulamayı kapatsanız da kaybolmaz.">
      <ListRow
        title="Fotoğraf Çek"
        subtitle="Arka arkaya çekebilirsiniz"
        icon={{ sf: 'camera.fill', ion: 'camera', color: theme.blue }}
        onPress={() => router.push({ pathname: '/camera', params: { mode: 'batch' } })}
        disabled={disabled}
        chevron
      />
      <ListRow
        title="Galeriden Seç"
        icon={{ sf: 'photo.on.rectangle.angled', ion: 'images', color: theme.green }}
        onPress={pickFromGallery}
        disabled={disabled}
        chevron
      />
    </ListSection>
  );
}
