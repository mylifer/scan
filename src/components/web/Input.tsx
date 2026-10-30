import { useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, TextInput, type TextInputProps, View, type ViewStyle } from 'react-native';

import { fontFamily, useShadcnTheme } from '../../lib/theme';
import { Icon } from '../ui/Icon';

interface InputProps extends TextInputProps {
  icon?: { sf: string; ion: string };
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Shadcn UI Web Metin Girdisi bileşeni.
 */
export function WebInput({ icon, onClear, value, containerStyle, style, ...rest }: InputProps) {
  const t = useShadcnTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: focused ? t.foreground : t.border,
          backgroundColor: t.card,
        },
        containerStyle,
      ]}>
      {icon && (
        <View style={styles.iconWrap}>
          <Icon sf={icon.sf} ion={icon.ion} size={15} color={t.mutedForeground} />
        </View>
      )}
      <TextInput
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={t.mutedForeground}
        style={[
          styles.input,
          {
            color: t.cardForeground,
          },
          style,
        ]}
        {...rest}
      />
      {!!value && onClear && (
        <Pressable onPress={onClear} hitSlop={6} style={styles.clearBtn} accessibilityLabel="Temizle">
          <Icon sf="xmark.circle.fill" ion="close-circle" size={15} color={t.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 8,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily,
    fontSize: 13,
    paddingVertical: 0,
    outlineStyle: 'none' as unknown as undefined,
  },
  clearBtn: {
    padding: 2,
    cursor: 'pointer',
  },
});
