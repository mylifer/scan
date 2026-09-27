import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../lib/theme';
import { subscribeToast, type ToastMessage } from '../lib/toast';

const useNativeDriver = Platform.OS !== 'web';

const palette = {
  success: { bg: '#064E3B', icon: '✅' },
  info: { bg: colors.text, icon: 'ℹ️' },
  error: { bg: '#7F1D1D', icon: '⚠️' },
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver }).start(() => setToast(null));
  };

  useEffect(
    () =>
      subscribeToast((t) => {
        if (timer.current) clearTimeout(timer.current);
        setToast(t);
        anim.setValue(0);
        Animated.spring(anim, { toValue: 1, useNativeDriver, friction: 8 }).start();
        timer.current = setTimeout(hide, t.duration);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!toast) return null;
  const { bg, icon } = palette[toast.type];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
        },
      ]}>
      <Pressable onPress={hide} style={[styles.toast, { backgroundColor: bg }]}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.text}>{toast.text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 1000, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    maxWidth: 480,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { fontSize: 16 },
  text: { color: '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1 },
});
