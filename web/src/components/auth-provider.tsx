"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import { supabaseButceUzak } from "@shared/lib/budgetSync";
import { setBudgetOwner, setBudgetRemote } from "@/lib/budget";
import { clearEFaturaCaches, setEFaturaCacheOwner } from "@/lib/efatura";
import { supabase } from "@/lib/supabase";

type AuthState = { session: Session | null; loading: boolean };

// Bütçe, kurulum (008) yapıldıysa telefonla ortak buluttan eşitlenir
setBudgetRemote(supabaseButceUzak(supabase));

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEFaturaCacheOwner(data.session?.user.id ?? null);
      setBudgetOwner(data.session?.user.id ?? null);
      setState({ session: data.session, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Önceki kullanıcının e-Fatura önbellekleri bir sonraki girişe taşınmasın
      if (event === "SIGNED_OUT") clearEFaturaCaches();
      else setEFaturaCacheOwner(session?.user.id ?? null);
      setBudgetOwner(event === "SIGNED_OUT" ? null : (session?.user.id ?? null));
      setState({ session, loading: false });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
