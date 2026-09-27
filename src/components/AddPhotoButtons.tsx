import { router } from 'expo-router';

import { PrimaryButton } from './PrimaryButton';

export interface PickedPhoto {
  uri: string;
  width: number;
}

interface Props {
  onPicked: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
}

/** Native: kamera ekranını toplu modda açar; çekilen her fotoğraf orada taslağa eklenir. */
export function AddPhotoButtons({ disabled }: Props) {
  return (
    <PrimaryButton
      title="📷  Arka arkaya fotoğraf çek"
      onPress={() => router.push({ pathname: '/camera', params: { mode: 'batch' } })}
      disabled={disabled}
    />
  );
}
