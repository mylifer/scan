import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';

import { clearCache } from '../lib/offlineCache';
import { initialAuthLink, supabase } from '../services/supabase/client';

interface AuthState {
  session: Session | null;
  loading: boolean;
  /** Şifre sıfırlama bağlantısıyla gelindi: yeni şifre belirlenmeli */
  recovering: boolean;
  /** Sıfırlama bağlantısı geçersiz/süresi dolmuşsa Supabase'in açıklaması */
  linkError: string | null;
  finishRecovery: () => void;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true, recovering: false, linkError: null, finishRecovery: () => {} });

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
  const [recovering, setRecovering] = useState(initialAuthLink.recovery);
  const [linkError] = useState(initialAuthLink.error);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Oturum düğmeyle değil süre dolarak kapansa da önbellekteki fişler silinsin
      if (event === 'SIGNED_OUT') clearCache();
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, recovering, linkError, finishRecovery: () => setRecovering(false) }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
