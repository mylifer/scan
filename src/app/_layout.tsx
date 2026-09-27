import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '../components/ToastHost';
import { ActionSheetHost } from '../components/ui/ActionSheetHost';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { largeTitle, stackScreenOptions } from '../lib/navigation';
import { useTheme } from '../lib/theme';

function RootNavigator() {
  const theme = useTheme();
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={stackScreenOptions(theme)}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="index" options={{ title: 'Giderler', ...largeTitle }} />
        <Stack.Screen name="camera" options={{ headerShown: false, animation: 'fade', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="review" options={{ title: 'Fişi Kontrol Et' }} />
        <Stack.Screen name="batch" options={{ title: 'Toplu Tarama', ...largeTitle }} />
        <Stack.Screen name="batch-review" options={{ title: 'İncele' }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
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
