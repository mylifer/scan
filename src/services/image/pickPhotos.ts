import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto {
  uri: string;
  width: number;
}

/** Galeriden birden çok fotoğraf seçtirir (en fazla 50). Vazgeçilirse boş dizi; izin yoksa hata. */
export async function pickPhotos(): Promise<PickedPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Galeri izni verilmedi. Ayarlar’dan Fotoğraflar iznini açın.');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 50, quality: 1 });
  return result.canceled ? [] : result.assets.map((a) => ({ uri: a.uri, width: a.width }));
}
