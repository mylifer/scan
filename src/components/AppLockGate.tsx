import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Modal, StyleSheet, Text, View } from 'react-native';

import { type as t, useTheme } from '../lib/theme';
import { authenticate, isAppLockEnabled, LOCK_GRACE_MS, loadAppLock, lockAvailable, lockMethodLabel, useAppLockEnabled } from '../services/appLock';
import { Button } from './ui/Button';
import { IconTile } from './ui/IconTile';

/**
 * Face ID kilidi: açıksa uygulama açılışında ve arka planda 1 dakikadan uzun kaldıktan sonra kimlik doğrulama ister.
 * Uygulama arka plana geçerken (uygulama değiştiricide) içerik gizlenir.
 */
export function AppLockGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const enabled = useAppLockEnabled();
  // Ayar yüklenene kadar içerik gösterilmez (kilitliyken bir an görünmesin)
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [covered, setCovered] = useState(false);
  const [method, setMethod] = useState('Face ID');
  const backgroundAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await authenticate()) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadAppLock().then((on) => {
      if (!alive) return;
      setLocked(on);
      setReady(true);
      if (on) {
        lockMethodLabel().then((m) => alive && setMethod(m));
        void unlock();
      }
    });
    return () => {
      alive = false;
    };
  }, [unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (!isAppLockEnabled()) {
        setCovered(false);
        return;
      }
      if (state === 'background') {
        backgroundAt.current ??= Date.now();
        setCovered(true);
      } else if (state === 'inactive') {
        // Uygulama değiştiricide içerik görünmesin (doğrulama penceresi açıkken de 'inactive' olur)
        if (!prompting.current) setCovered(true);
      } else if (state === 'active') {
        setCovered(false);
        const away = backgroundAt.current;
        backgroundAt.current = null;
        if (away !== null && Date.now() - away >= LOCK_GRACE_MS) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => sub.remove();
  }, [unlock]);

  const showLock = enabled && locked;
  // Ayar okunana kadar (birkaç ms) yalnızca düz zemin: kilit açıksa içerik bir an bile görünmesin
  const loading = !ready && lockAvailable();
  return (
    <View style={{ flex: 1 }}>
      {children}
      {/* Açılışta (henüz modal ekran yokken) düz örtü yeterli */}
      {loading && <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />}
      {/* Modal: iOS'ta modal açılan ekranların (Ayarlar, Elle Ekle…) da üstünde görünür */}
      <Modal
        visible={!loading && (showLock || (enabled && covered))}
        animationType="none"
        presentationStyle="overFullScreen"
        transparent
        onRequestClose={() => {}}>
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: theme.background }]} accessibilityViewIsModal>
          <>
            <IconTile sf="lock.fill" ion="lock-closed" color={theme.blue} size={64} />
            <Text style={[t.title3, { color: theme.label }]}>Fiş Tarayıcı Kilitli</Text>
            {showLock ? (
              <View style={{ alignSelf: 'stretch', paddingHorizontal: 40, marginTop: 12 }}>
                <Button title={`${method} ile Aç`} onPress={unlock} />
              </View>
            ) : null}
          </>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 1000 },
});
