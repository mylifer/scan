import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, router, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppLockGate } from '../components/AppLockGate';
import { CategoryPickerHost } from '../components/CategoryPickerHost';
import { ResetPassword } from '../components/ResetPassword';
import { ToastHost } from '../components/ToastHost';
import { ActionSheetHost } from '../components/ui/ActionSheetHost';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { fullBleedContent, largeTitle, stackScreenOptions } from '../lib/navigation';
import { useTheme } from '../lib/theme';
import { setupNotifications, subscribeNotificationTaps } from '../services/reminders/notificationSetup';
import { MONTHLY_SUMMARY_KIND } from '../lib/monthlySummaryPlan';
import { refreshTaxReminders } from '../services/reminders/taxReminders';
import { installGlobalErrorHandlers, reportError } from '../services/errorLog';
import { loadCustomCategories } from '../services/supabase/categoriesRepository';
import { setupQuickActions } from '../services/quickActions';

// Bildirim davranışı uygulama açılışında bir kez ayarlanır (vergi hatırlatıcısı ön planda da görünsün);
// açıksa hatırlatıcı planı 6 ay ileriye yenilenir
setupNotifications();
void refreshTaxReminders();
// Beklenmeyen hatalar Ayarlar → Hata Kayıtları'na yazılır
installGlobalErrorHandlers();

function RootNavigator() {
  const theme = useTheme();
  const { session, loading, recovering, linkError } = useAuth();

  // Kullanıcının kendi kategorileri (giriş yapılınca yüklenir; çıkışta yalnızca hazır kategoriler kalır)
  const userId = session?.user.id ?? '';
  useEffect(() => {
    void loadCustomCategories(userId);
  }, [userId]);

  const signedIn = !!session;
  // Ana ekran kısayolları (Fiş Tara, Karekod…) yalnızca giriş yapılmışken
  useEffect(() => (signedIn ? setupQuickActions() : undefined), [signedIn]);

  // Aylık özet bildirimine dokunulunca o ayın özetini aç (giriş yapılmışsa)
  useEffect(() => {
    if (!signedIn) return;
    return subscribeNotificationTaps((data) => {
      if (data.kind === MONTHLY_SUMMARY_KIND && typeof data.month === 'string') {
        router.navigate({ pathname: '/', params: { ay: data.month } });
      }
    });
  }, [signedIn]);

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
        {/* Sekmeler tam genişlik: masaüstünde kenar menüsü solda kalsın, sayfa genişliğini her sekme kendisi sınırlar */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '', contentStyle: { backgroundColor: theme.background, flex: 1 } }} />
        <Stack.Screen name="camera" options={{ headerShown: false, animation: 'fade', presentation: 'fullScreenModal', ...fullBleedContent }} />
        <Stack.Screen name="review" options={{ title: 'Fişi Kontrol Et' }} />
        <Stack.Screen name="manual" options={{ title: 'Elle Fiş Ekle', presentation: 'modal' }} />
        <Stack.Screen name="setup-categories" options={{ title: 'Veritabanı Güncellemesi' }} />
        <Stack.Screen name="budget" options={{ title: 'Aylık Bütçe', presentation: 'modal' }} />
        <Stack.Screen name="tax-calendar" options={{ title: 'Vergi Takvimi' }} />
        <Stack.Screen name="efatura-detay" options={{ title: 'Fatura' }} />
        <Stack.Screen name="efatura-ozet" options={{ title: 'e-Fatura Özeti', ...largeTitle }} />
        <Stack.Screen name="merge-firms" options={{ title: 'Firma Adları' }} />
        <Stack.Screen name="trash" options={{ title: 'Son Silinenler' }} />
        <Stack.Screen name="recent" options={{ title: 'Son Eklenenler' }} />
        <Stack.Screen name="receipts" options={{ title: 'Tüm Fişler', ...largeTitle }} />
        <Stack.Screen name="firms" options={{ title: 'Firmalar', ...largeTitle }} />
        <Stack.Screen name="firm/[key]" options={{ title: 'Firma' }} />
        <Stack.Screen name="setup-trash" options={{ title: 'Çöp Kutusu' }} />
        <Stack.Screen name="categories" options={{ title: 'Kategoriler' }} />
        <Stack.Screen name="qr" options={{ headerShown: false, animation: 'fade', presentation: 'fullScreenModal', ...fullBleedContent }} />
        <Stack.Screen name="errors" options={{ title: 'Hata Kayıtları' }} />
        <Stack.Screen name="batch" options={{ title: 'Toplu Tarama', ...largeTitle }} />
        <Stack.Screen name="batch-review" options={{ title: 'İncele' }} />
        <Stack.Screen name="receipt/[id]" options={{ title: 'Fiş' }} />
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
  useEffect(() => reportError('ekran çöktü', error), [error]);

  const isChunkError =
    Platform.OS === 'web' &&
    /Loading (module|chunk)|dynamically imported module|failed to fetch/i.test(String(error?.message ?? error));

  useEffect(() => {
    if (isChunkError && typeof window !== 'undefined') {
      const k = 'chunk_eb_reload';
      const last = sessionStorage.getItem(k);
      const now = Date.now();
      if (!last || now - parseInt(last, 10) > 10000) {
        sessionStorage.setItem(k, String(now));
        window.location.reload();
      }
    }
  }, [isChunkError]);

  if (isChunkError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background, padding: 20 }}>
        <EmptyState
          icon={{ sf: 'arrow.clockwise.circle', ion: 'reload-outline' }}
          title="Yeni Sürüm Yayınlandı"
          message="Uygulama sunucuda güncellendi. En son sürüme geçmek için lütfen sayfayı yenileyin."
        />
        <Button
          title="Sayfayı Yenile"
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.location.reload();
            } else {
              retry();
            }
          }}
        />
      </View>
    );
  }

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
          {/* Gezinme renkleri uygulama temasından: web'de sayfa kenarları koyu temada açık gri kalmasın */}
          <ThemeProvider
            value={{
              ...(theme.dark ? DarkTheme : DefaultTheme),
              colors: { ...(theme.dark ? DarkTheme : DefaultTheme).colors, background: theme.background, card: theme.card, primary: theme.blue, text: theme.label, border: theme.separator },
            }}>
            <AppLockGate>
              <RootNavigator />
            </AppLockGate>
          </ThemeProvider>
          <ToastHost />
          <ActionSheetHost />
          <CategoryPickerHost />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
