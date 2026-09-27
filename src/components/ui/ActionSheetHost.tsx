import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type SheetRequest, subscribeActionSheet } from '../../lib/actionSheet';
import { type as t, useTheme } from '../../lib/theme';

/** iOS dışı platformlarda (web) sistem action sheet'inin görünümünü taklit eder. */
export function ActionSheetHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [req, setReq] = useState<SheetRequest | null>(null);

  useEffect(() => subscribeActionSheet(setReq), []);

  const close = () => setReq(null);
  const cancel = () => {
    req?.onCancel?.();
    close();
  };
  const bg = theme.dark ? '#2C2C2E' : '#F9F9F9';

  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.backdrop} onPress={cancel}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={[styles.group, { backgroundColor: bg }]}>
            {(req?.title || req?.message) && (
              <View style={[styles.head, { borderBottomColor: theme.separator }]}>
                {req.title && <Text style={[t.footnote, { color: theme.secondaryLabel, fontWeight: '600', textAlign: 'center' }]}>{req.title}</Text>}
                {req.message && <Text style={[t.footnote, { color: theme.secondaryLabel, textAlign: 'center' }]}>{req.message}</Text>}
              </View>
            )}
            {req?.options.map((o, i) => (
              <Pressable
                key={o.label}
                onPress={() => {
                  close();
                  o.onPress();
                }}
                style={({ pressed }) => [
                  styles.option,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.separator },
                  pressed && { backgroundColor: theme.highlight },
                ]}>
                <Text style={[styles.optionText, { color: o.destructive ? theme.red : theme.blue }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={cancel} style={({ pressed }) => [styles.group, styles.option, { backgroundColor: pressed ? theme.highlight : bg }]}>
            <Text style={[styles.optionText, { color: theme.blue, fontWeight: '600' }]}>{req?.cancelLabel}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 8, gap: 8, width: '100%', maxWidth: 500, alignSelf: 'center' },
  group: { borderRadius: 14, overflow: 'hidden' },
  head: { paddingVertical: 14, paddingHorizontal: 16, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  option: { height: 57, alignItems: 'center', justifyContent: 'center' },
  optionText: { fontSize: 20, letterSpacing: 0.38 },
});
