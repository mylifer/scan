import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SUPABASE_SQL_EDITOR_URL } from '../lib/setupSql';
import { useTheme } from '../lib/theme';
import { showToast } from '../lib/toast';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { ListRow, ListSection } from './ui/List';

/** Supabase'de tek seferlik SQL kurulumu: kodu kopyala → SQL ekranını aç → kontrol et. */
export function SetupSteps({ sql, message, onCheck }: { sql: string; message: string; onCheck: () => Promise<unknown> }) {
  const theme = useTheme();
  const [showCode, setShowCode] = useState(false);
  const [checking, setChecking] = useState(false);

  async function copy() {
    try {
      if (!(await Clipboard.setStringAsync(sql))) throw new Error();
      showToast('Kod kopyalandı');
    } catch {
      setShowCode(true);
      showToast('Kopyalanamadı; kodu aşağıdan seçin', 'info', 4000);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 40 }}>
      <EmptyState icon={{ sf: 'wrench.and.screwdriver.fill', ion: 'construct' }} title="Tek Seferlik Kurulum" message={message} />
      <ListSection header="Adımlar" footer='Kodu SQL ekranına yapıştırıp "Run" düğmesine basın. "Success" yazısını görünce kurulumu kontrol edin.'>
        <ListRow title="1. Kurulum Kodunu Kopyala" icon={{ sf: 'doc.on.doc.fill', ion: 'copy', color: theme.blue }} onPress={copy} />
        <ListRow
          title="2. Supabase SQL Ekranını Aç"
          icon={{ sf: 'arrow.up.right.square.fill', ion: 'open', color: theme.green }}
          onPress={() => Linking.openURL(SUPABASE_SQL_EDITOR_URL)}
        />
        <ListRow title={showCode ? 'Kodu Gizle' : 'Kodu Göster'} tone="action" onPress={() => setShowCode((v) => !v)} />
      </ListSection>
      {showCode && (
        <TextInput value={sql} multiline editable={false} selectTextOnFocus style={[styles.code, { backgroundColor: theme.card, color: theme.label }]} />
      )}
      <View style={{ paddingHorizontal: 16 }}>
        <Button
          title="3. Kurulumu Kontrol Et"
          loading={checking}
          onPress={async () => {
            setChecking(true);
            try {
              await onCheck();
            } finally {
              setChecking(false);
            }
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  code: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    borderRadius: 12,
    padding: 12,
    height: 260,
    marginHorizontal: 16,
    marginBottom: 28,
  },
});
