import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/ui/Button';
import { Image } from 'expo-image';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { haptics } from '../lib/haptics';
import { fontFamily, type as t, useTheme } from '../lib/theme';
import { supabase } from '../services/supabase/client';

export default function LoginScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'signin' | 'signup' | null>(null);

  async function submit(mode: 'signin' | 'signup') {
    // Klavyedeki "Git" tuşu düğmeden bağımsız çağırır; istek sürerken ikinci kez gönderme
    if (busy) return;
    if (!email.trim() || password.length < 6) {
      haptics.error();
      showAlert('Eksik bilgi', 'Geçerli bir e-posta ve en az 6 karakterli bir şifre girin.');
      return;
    }
    setBusy(mode);
    const credentials = { email: email.trim(), password };
    const { data, error } =
      mode === 'signin' ? await supabase.auth.signInWithPassword(credentials) : await supabase.auth.signUp(credentials);
    setBusy(null);
    if (error) {
      haptics.error();
      showAlert(mode === 'signin' ? 'Giriş yapılamadı' : 'Hesap oluşturulamadı', errorMessage(error));
    } else if (mode === 'signup' && !data.session) {
      showAlert('E-postanızı kontrol edin', 'Hesabınızı doğrulamak için gönderilen bağlantıya dokunun.');
    } else {
      haptics.success();
    }
  }

  const inputStyle = [t.body, styles.input, { color: theme.label }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
          <Text style={[t.largeTitle, { color: theme.label, marginTop: 20 }]}>Fiş Tarayıcı</Text>
          <Text style={[t.body, { color: theme.secondaryLabel, textAlign: 'center' }]}>
            Fişlerinizi tarayın, giderlerinizi ve KDV alacağınızı takip edin.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <TextInput
            style={inputStyle}
            placeholder="E-posta"
            placeholderTextColor={theme.tertiaryLabel}
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
          />
          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
          <TextInput
            style={inputStyle}
            placeholder="Şifre"
            placeholderTextColor={theme.tertiaryLabel}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => submit('signin')}
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Button title="Giriş Yap" onPress={() => submit('signin')} loading={busy === 'signin'} disabled={busy === 'signup'} />
          <Button title="Hesap Oluştur" variant="plain" onPress={() => submit('signup')} loading={busy === 'signup'} disabled={busy === 'signin'} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 28, maxWidth: 480, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  appIcon: { width: 88, height: 88, borderRadius: 20 },
  card: { borderRadius: 12, overflow: 'hidden' },
  input: { height: 50, paddingHorizontal: 16, fontFamily, ...Platform.select({ web: { outlineWidth: 0 } }) },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
