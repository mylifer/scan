import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../lib/haptics';
import { type as t, useTheme } from '../lib/theme';
import { subscribeToast, type ToastMessage } from '../lib/toast';
import { Icon } from './ui/Icon';

const useNativeDriver = Platform.OS !== 'web';

/** Dynamic Island bildirimlerini andıran, üstten inip kaybolan kapsül. */
export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    // Kaybolma sırasında yeni toast gelirse animasyon yarıda kesilir (finished=false); o zaman
    // yeni toast'ı silmemek için yalnızca animasyon gerçekten bittiyse temizle
    Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  };

  useEffect(
    () =>
      subscribeToast((next) => {
        if (timer.current) clearTimeout(timer.current);
        setToast(next);
        if (next.type === 'success') haptics.success();
        else if (next.type === 'error') haptics.error();
        anim.setValue(0);
        Animated.spring(anim, { toValue: 1, useNativeDriver, damping: 18, stiffness: 220 }).start();
        timer.current = setTimeout(hide, next.duration);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!toast) return null;
  const icon =
    toast.type === 'success'
      ? { sf: 'checkmark.circle.fill', ion: 'checkmark-circle', color: theme.green }
      : toast.type === 'error'
        ? { sf: 'exclamationmark.triangle.fill', ion: 'warning', color: theme.orange }
        : { sf: 'info.circle.fill', ion: 'information-circle', color: theme.blue };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 6,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
          ],
        },
      ]}>
      <Pressable onPress={hide} style={[styles.shadow, { shadowOpacity: theme.dark ? 0 : 0.15 }]}>
        <BlurView
          intensity={90}
          tint={theme.dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
          style={[styles.pill, { borderColor: theme.separator }]}>
          <Icon sf={icon.sf} ion={icon.ion} size={20} color={icon.color} />
          <Text style={[t.subhead, { color: theme.label, fontWeight: '600', flexShrink: 1 }]}>{toast.text}</Text>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 1000, alignItems: 'center' },
  shadow: { shadowColor: '#000', shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, borderRadius: 999 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 440,
  },
});
