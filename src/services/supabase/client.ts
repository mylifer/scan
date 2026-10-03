import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!url || !key) {
  console.warn('Supabase ayarları eksik: .env içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY tanımlayın.');
}

/**
 * Şifre sıfırlama e-postasındaki bağlantı web sürümünü #access_token=…&type=recovery ile açar.
 * Supabase bu adresi işleyip temizlemeden önce okunur (oturum açılış olayını kaçırmamak için).
 */
function readAuthLink(): { recovery: boolean; error: string | null } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { recovery: false, error: null };
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return { recovery: params.get('type') === 'recovery', error: params.get('error_description') ?? params.get('error') };
}

export const initialAuthLink = readAuthLink();

/** Şifre sıfırlama bağlantısının açılacağı adres (Supabase → Authentication → URL Configuration'da izinli olmalı) */
export const PASSWORD_RESET_REDIRECT = 'https://mylifer.github.io/scan/';

export const supabase = createClient(url, key, {
  auth: {
    ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    // Web: şifre sıfırlama bağlantısındaki oturumu adresten al (iPhone'da bağlantı tarayıcıda açılır)
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Uygulama ön plandayken oturum yenilemesini sürdür, arka planda durdur.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
