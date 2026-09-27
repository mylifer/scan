import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { fontFamily, type as t, useTheme } from '../../lib/theme';
import { Icon } from './Icon';

/** iOS arama alanı görünümünde metin kutusu (native arama çubuğu olmayan platformlar için). */
export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.field, { backgroundColor: theme.tertiaryFill }]}>
      <Icon sf="magnifyingglass" ion="search" size={16} color={theme.secondaryLabel} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.secondaryLabel}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[t.body, styles.input, { color: theme.label }]}
      />
      {!!value && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
          <Icon sf="xmark.circle.fill" ion="close-circle" size={17} color={theme.tertiaryLabel} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 8, height: 36 },
  input: { flex: 1, paddingVertical: 0, fontFamily, ...Platform.select({ web: { outlineWidth: 0 } }) },
});
