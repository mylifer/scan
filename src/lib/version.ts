import Constants from 'expo-constants';

/** app.json'daki sürüm (ör. "1.1.0") */
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/** Yayını yapan commit'in kısa kodu (CI ortam değişkeninden) */
export const BUILD_COMMIT = (process.env.EXPO_PUBLIC_APP_VERSION ?? '').slice(0, 7) || 'geliştirme';

/** "1.1.0 (a1b2c3d)" */
export const VERSION_LABEL = `${APP_VERSION} (${BUILD_COMMIT})`;
