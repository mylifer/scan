import { Platform, useWindowDimensions } from 'react-native';

/** Bu genişlikten itibaren web sürümü masaüstü pano düzenine geçer (kenar menüsü, çok sütun) */
export const WIDE_MIN_WIDTH = 1024;

/** Masaüstü tarayıcıda pano sayfalarının en geniş hâli */
export const DASHBOARD_MAX_WIDTH = 1320;

/** Web'de geniş pencere mi (telefon ve iPad uygulamasında hep false) */
export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE_MIN_WIDTH;
}
