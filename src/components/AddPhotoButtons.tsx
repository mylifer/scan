import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { showToast } from '../lib/toast';
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
 * Native: "Fotoğraf çek" kamerayı toplu modda açar (her çekim orada taslağa eklenir);
 * "Galeriden" birden fazla fotoğraf seçtirir.
 */
export function AddPhotoButtons({ onPicked, disabled }: Props) {
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
    if (!result.canceled && result.assets.length) {
      onPicked(result.assets.map((a) => ({ uri: a.uri, width: a.width })));
    }
  }

  return (
    <View style={styles.row}>
      <PrimaryButton
        title="📷  Fotoğraf çek"
        onPress={() => router.push({ pathname: '/camera', params: { mode: 'batch' } })}
        disabled={disabled}
        style={{ flex: 1 }}
      />
      <PrimaryButton
        title="🖼️  Galeriden"
        variant="secondary"
        onPress={pickFromGallery}
        disabled={disabled}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 10 } });
