import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '../components/PrimaryButton';
import { showAlert } from '../lib/alert';
import { colors } from '../lib/theme';
import { supabase } from '../services/supabase/client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'signin' | 'signup' | null>(null);

  async function submit(mode: 'signin' | 'signup') {
    if (!email.trim() || password.length < 6) {
      showAlert('Eksik bilgi', 'Geçerli bir e-posta ve en az 6 karakterli bir şifre girin.');
      return;
    }
    setBusy(mode);
    const credentials = { email: email.trim(), password };
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setBusy(null);
    if (error) {
      showAlert('Hata', error.message);
    } else if (mode === 'signup' && !data.session) {
      showAlert('E-postanızı kontrol edin', 'Hesabınızı doğrulamak için gönderilen bağlantıya tıklayın.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <Text style={styles.logo}>🧾</Text>
        <Text style={styles.title}>Fiş Tarayıcı</Text>
        <Text style={styles.subtitle}>Gider ve KDV takibi</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Şifre"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          <PrimaryButton title="Giriş yap" onPress={() => submit('signin')} loading={busy === 'signin'} />
          <PrimaryButton
            title="Hesap oluştur"
            variant="secondary"
            onPress={() => submit('signup')}
            loading={busy === 'signup'}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: colors.text, textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginBottom: 32 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 16,
    color: colors.text,
  },
});
