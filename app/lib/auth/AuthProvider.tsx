"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/app/lib/supabase/client";

export interface Profile {
  id: string;
  username: string; // minúsculas, tal cual en la BD
}

interface AuthState {
  user: User | null; // de @supabase/supabase-js
  profile: Profile | null;
  loading: boolean; // true hasta resolver la sesión inicial
  signOut: () => Promise<void>;
}

// Profile cargado junto con el id del usuario al que pertenece, para no
// mostrar el profile de una sesión anterior mientras llega el nuevo.
interface LoadedProfile {
  userId: string;
  profile: Profile | null;
}

const AuthContext = createContext<AuthState | null>(null);

// Única fuente de sesión en cliente (SPEC 12). Montado en app/layout.tsx.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(createClient);
  const [user, setUser] = useState<User | null>(null);
  const [userResolved, setUserResolved] = useState(false);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user);
      setUserResolved(true);
    });

    // Sin llamadas a Supabase dentro del callback: el profile se carga en
    // el efecto de abajo, al cambiar el id del usuario.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setUserResolved(true);
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLoaded({ userId, profile: data ?? null });
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const signOut = useCallback(async () => {
    // El estado se limpia vía onAuthStateChange.
    await supabase.auth.signOut();
  }, [supabase]);

  const profileReady = userId === null || loaded?.userId === userId;
  const profile = userId && loaded?.userId === userId ? loaded.profile : null;
  const loading = !userResolved || !profileReady;

  const value = useMemo<AuthState>(
    () => ({ user, profile, loading, signOut }),
    [user, profile, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() debe usarse dentro de <AuthProvider>");
  return ctx;
}
