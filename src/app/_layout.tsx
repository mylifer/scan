import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ResetPassword } from '../components/ResetPassword';
import { ToastHost } from '../components/ToastHost';
import { ActionSheetHost } from '../components/ui/ActionSheetHost';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { largeTitle, stackScreenOptions } from '../lib/navigation';
import { useTheme } from '../lib/theme';
import { setupNotifications } from '../services/reminders/notificationSetup';
import { refreshTaxReminders } from '../services/reminders/taxReminders';

// Bildirim davranışı uygulama açılışında bir kez ayarlanır (vergi hatırlatıcısı ön planda da görünsün);
// açıksa hatırlatıcı planı 6 ay ileriye yenilenir
setupNotifications();
void refreshTaxReminders();

function RootNavigator() {
  const theme = useTheme();
  const { session, loading, recovering, linkError } = useAuth();

  // Geçersiz/süresi dolmuş sıfırlama bağlantısı: bir kez bildir
  useEffect(() => {
    if (linkError) showAlert('Bağlantı geçersiz', `Şifre sıfırlama bağlantısı geçersiz ya da süresi dolmuş. Giriş ekranından yeniden isteyin.\n\n(${linkError})`);
  }, [linkError]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Şifre sıfırlama bağlantısıyla gelindiyse önce yeni şifre belirlensin
  if (recovering && session) return <ResetPassword />;

  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" options={{ title: 'Giderler', ...largeTitle }} />
        <Stack.Screen name="camera" options={{ headerShown: false, animation: 'fade', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="review" options={{ title: 'Fişi Kontrol Et' }} />
        <Stack.Screen name="manual" options={{ title: 'Elle Fiş Ekle', presentation: 'modal' }} />
        <Stack.Screen name="setup-categories" options={{ title: 'Yeni Kategoriler' }} />
        <Stack.Screen name="budget" options={{ title: 'Aylık Bütçe', presentation: 'modal' }} />
        <Stack.Screen name="tax-calendar" options={{ title: 'Vergi Takvimi' }} />
        <Stack.Screen name="batch" options={{ title: 'Toplu Tarama', ...largeTitle }} />
        <Stack.Screen name="batch-review" options={{ title: 'İncele' }} />
        <Stack.Screen name="receipt/[id]" options={{ title: 'Fiş' }} />
        <Stack.Screen name="settings" options={{ title: 'Ayarlar', presentation: 'modal', ...largeTitle }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * Beklenmeyen bir hata ekranı çökertirse beyaz sayfa yerine bu gösterilir.
 * (expo-router, kök layout'tan dışa aktarılan ErrorBoundary'yi kullanır.)
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background, padding: 20 }}>
      <EmptyState
        icon={{ sf: 'exclamationmark.triangle', ion: 'warning-outline' }}
        title="Bir Şeyler Ters Gitti"
        message={`Uygulama beklenmedik bir hatayla karşılaştı. Verileriniz güvende.\n\n${errorMessage(error)}`}
      />
      <Button title="Tekrar Dene" onPress={retry} />
    </View>
  );
}

export default function RootLayout() {
  const theme = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style={theme.dark ? 'light' : 'dark'} />
          <RootNavigator />
          <ToastHost />
          <ActionSheetHost />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
