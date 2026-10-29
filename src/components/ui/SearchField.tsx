import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useWide } from '../../lib/layout';
import { fontFamily, type as t, useShadcnTheme, useTheme } from '../../lib/theme';
import { Icon } from './Icon';

/** Shadcn Input görünümünde arama alanı */
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const theme = useTheme();
  const st = useShadcnTheme();
  const wide = useWide();

  if (wide) {
    return (
      <View
        style={[
          styles.fieldWide,
          {
            backgroundColor: st.card,
            borderColor: st.border,
          },
        ]}>
        <Icon sf="magnifyingglass" ion="search" size={15} color={st.mutedForeground} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={st.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.inputWide, { color: st.cardForeground }]}
        />
        {!!value ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
            <Icon sf="xmark.circle.fill" ion="close-circle" size={16} color={st.mutedForeground} />
          </Pressable>
        ) : (
          <View style={[styles.kbdBadge, { backgroundColor: st.muted, borderColor: st.border }]}>
            <Text style={[styles.kbdText, { color: st.mutedForeground }]}>⌘K</Text>
          </View>
        )}
      </View>
    );
  }

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

  // Shadcn Wide Input styles
  fieldWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 38,
  },
  inputWide: {
    flex: 1,
    fontFamily,
    fontSize: 13,
    paddingVertical: 0,
    ...Platform.select({ web: { outlineWidth: 0 } }),
  },
  kbdBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  kbdText: {
    fontFamily,
    fontSize: 11,
    fontWeight: '500',
  },
});
