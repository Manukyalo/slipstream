import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Sign in with email + password */
  signInWithEmail: (email: string, password: string) => Promise<AuthError | null>;
  /** Sign up with email + password, with optional referral attribution code */
  signUpWithEmail: (email: string, password: string, referralCode?: string) => Promise<AuthError | null>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Refresh profile from DB */
  refreshProfile: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Fetch profile from Supabase (called after session resolves)
  const fetchProfile = useCallback(async (userId: string): Promise<void> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!isMounted.current) return;

    if (error) {
      console.warn('[Auth] Profile fetch failed:', error.message);
      return;
    }

    setProfile(data);
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (session?.user.id) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  // Subscribe to Supabase auth state changes
  useEffect(() => {
    // Get initial session (reads from SecureStore synchronously via the adapter)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted.current) return;
      setSession(initialSession);
      setStatus(initialSession ? 'authenticated' : 'unauthenticated');

      if (initialSession?.user.id) {
        fetchProfile(initialSession.user.id);
      }
    });

    // Subscribe to future state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!isMounted.current) return;
        setSession(newSession);
        setStatus(newSession ? 'authenticated' : 'unauthenticated');

        if (newSession?.user.id) {
          fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ---------------------------------------------------------------------------
  // Auth actions
  // ---------------------------------------------------------------------------

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error;
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, referralCode?: string): Promise<AuthError | null> => {
      const options = referralCode ? { data: { referral_code: referralCode } } : undefined;
      const { error } = await supabase.auth.signUp({ email, password, options });
      return error;
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        user: session?.user ?? null,
        profile,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
