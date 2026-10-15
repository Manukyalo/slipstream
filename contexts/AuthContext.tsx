import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { createVehicle } from '@/services/vehicles';

WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface OnboardingData {
  handle: string;
  vehicle?: {
    make: string;
    model: string;
    year: number;
  } | null;
  speedUnit: 'kmh' | 'mph';
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Sign in with Google via OAuth browser session */
  signInWithGoogle: () => Promise<AuthError | null>;
  /** Sign in with Apple via native modal + Supabase ID token */
  signInWithApple: () => Promise<AuthError | null>;
  /** Send a passwordless 6-digit OTP code to the given email */
  sendEmailOtp: (email: string) => Promise<AuthError | null>;
  /** Verify the 6-digit email OTP code */
  verifyEmailOtp: (email: string, token: string) => Promise<AuthError | null>;
  /** Link external identity (Google / Apple) to current authenticated account */
  linkIdentity: (provider: 'google' | 'apple') => Promise<AuthError | null>;
  /** Complete initial onboarding profile, vehicle, and units */
  completeOnboarding: (data: OnboardingData) => Promise<{ success: boolean; error?: string }>;
  /** Sign in with email + password (legacy fallback) */
  signInWithEmail: (email: string, password: string) => Promise<AuthError | null>;
  /** Sign up with email + password (legacy fallback) */
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

      // If already signed in, link account instead of replacing
      if (session?.user) {
        const { data, error } = await supabase.auth.linkIdentity({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) return error;
        if (data?.url) {
          await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        }
        return null;
      }

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
  }, [session]);

  const signInWithApple = useCallback(async (): Promise<AuthError | null> => {
    try {
      if (Platform.OS !== 'ios') {
        return new Error('Sign in with Apple is only supported on iOS devices.') as unknown as AuthError;
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return new Error('Apple Authentication is not available on this device.') as unknown as AuthError;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return new Error('No identity token returned from Apple.') as unknown as AuthError;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) return error;

      // When Apple provides fullName (first sign-in only), update profile if not already set
      if (credential.fullName && data.user) {
        const given = credential.fullName.givenName || '';
        const family = credential.fullName.familyName || '';
        const fullName = `${given} ${family}`.trim();

        if (fullName) {
          await supabase
            .from('profiles')
            .update({ display_name: fullName })
            .eq('id', data.user.id);
        }
      }

      return null;
    } catch (err: unknown) {
      // User cancelled modal
      if ((err as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
        return null;
      }
      return err as AuthError;
    }
  }, []);

  const sendEmailOtp = useCallback(async (email: string): Promise<AuthError | null> => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });
      return error;
    } catch (err: unknown) {
      return err as AuthError;
    }
  }, []);

  const verifyEmailOtp = useCallback(
    async (email: string, token: string): Promise<AuthError | null> => {
      try {
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: token.trim(),
          type: 'email',
        });
        return error;
      } catch (err: unknown) {
        return err as AuthError;
      }
    },
    [],
  );

  const linkIdentity = useCallback(
    async (provider: 'google' | 'apple'): Promise<AuthError | null> => {
      if (provider === 'apple') {
        return signInWithApple();
      }
      return signInWithGoogle();
    },
    [signInWithApple, signInWithGoogle],
  );

  const completeOnboarding = useCallback(
    async (data: OnboardingData): Promise<{ success: boolean; error?: string }> => {
      try {
        const currentUserId = session?.user?.id;
        if (!currentUserId) {
          return { success: false, error: 'User is not authenticated.' };
        }

        const cleanHandle = data.handle.trim().replace(/^@/, '');

        // 1. Update display_name in profiles table
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ display_name: cleanHandle })
          .eq('id', currentUserId);

        if (profileError) {
          return { success: false, error: profileError.message };
        }

        // 2. Add vehicle if provided
        if (data.vehicle && data.vehicle.make && data.vehicle.model) {
          try {
            await createVehicle({
              userId: currentUserId,
              make: data.vehicle.make,
              model: data.vehicle.model,
              year: data.vehicle.year || new Date().getFullYear(),
              isPrimary: true,
            });
          } catch (vehErr) {
            console.warn('[Auth] Vehicle creation warning during onboarding:', vehErr);
          }
        }

        // 3. Persist units to local storage & Supabase user metadata
        await AsyncStorage.setItem('@slipstream/units', data.speedUnit);
        await supabase.auth.updateUser({
          data: {
            speed_unit: data.speedUnit,
            onboarding_completed: true,
          },
        });

        // 4. Mark local onboarding completion flag
        await AsyncStorage.setItem(`@slipstream/onboarded_${currentUserId}`, 'true');

        // 5. Refresh cached profile
        await fetchProfile(currentUserId);

        return { success: true };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to complete onboarding.';
        return { success: false, error: msg };
      }
    },
    [session, fetchProfile],
  );

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
        signInWithApple,
        sendEmailOtp,
        verifyEmailOtp,
        linkIdentity,
        completeOnboarding,
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
