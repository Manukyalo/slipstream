import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Sign in with Google via OAuth browser session */
  signInWithGoogle: () => Promise<AuthError | null>;
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

  const signInWithGoogle = useCallback(async (): Promise<AuthError | null> => {
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) return error;
      if (!data?.url) return null;

      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (res.type === 'success' && res.url) {
        const parsed = Linking.parse(res.url);
        if (parsed.queryParams?.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            String(parsed.queryParams.code),
          );
          return exchangeError;
        }

        // Handle fragment tokens (#access_token=...&refresh_token=...)
        if (res.url.includes('#access_token=') || res.url.includes('?access_token=')) {
          const fragment = res.url.split('#')[1] || res.url.split('?')[1];
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            return sessionError;
          }
        }
      }
      return null;
    } catch (err: unknown) {
      return err as AuthError;
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error;
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, referralCode?: string): Promise<AuthError | null> => {
      const redirectUrl = Linking.createURL('auth/callback');
      const options: { emailRedirectTo: string; data?: { referral_code: string } } = {
        emailRedirectTo: redirectUrl,
        ...(referralCode ? { data: { referral_code: referralCode } } : {}),
      };
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
        signInWithGoogle,
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
