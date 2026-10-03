import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';
import { showAlert } from '../lib/alert';
import { errorMessage } from '../lib/errors';
import { haptics } from '../lib/haptics';
import { fontFamily, type as t, useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { supabase } from '../services/supabase/client';
import { Button } from './ui/Button';

/** Şifre sıfırlama bağlantısıyla gelen kullanıcı yeni şifresini belirler. */
export function ResetPassword() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (password.length < 6) return showAlert('Şifre çok kısa', 'Şifre en az 6 karakter olmalı.');
    if (password !== repeat) return showAlert('Şifreler aynı değil', 'İki alana aynı şifreyi yazın.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      haptics.error();
      showAlert('Şifre değiştirilemedi', errorMessage(error));
      return;
    }
    haptics.success();
    showToast('Şifreniz değiştirildi. iPhone uygulamasında da yeni şifreyle giriş yapabilirsiniz.', 'success', 4500);
    finishRecovery();
  }

  const input = [t.body, styles.input, { color: theme.label }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64 }]} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 8 }}>
          <Text style={[t.largeTitle, { color: theme.label }]}>Yeni Şifre</Text>
          <Text style={[t.body, { color: theme.secondaryLabel }]}>Hesabınız için yeni bir şifre belirleyin.</Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <TextInput
            style={input}
            placeholder="Yeni şifre"
            placeholderTextColor={theme.tertiaryLabel}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
          <TextInput
            style={input}
            placeholder="Yeni şifre (tekrar)"
            placeholderTextColor={theme.tertiaryLabel}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={save}
            value={repeat}
            onChangeText={setRepeat}
          />
        </View>
        <Button title="Şifreyi Kaydet" onPress={save} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 28, maxWidth: 480, width: '100%', alignSelf: 'center' },
  card: { borderRadius: 12, overflow: 'hidden' },
  input: { height: 50, paddingHorizontal: 16, fontFamily, ...Platform.select({ web: { outlineWidth: 0 } }) },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
