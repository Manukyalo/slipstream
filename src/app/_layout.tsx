/**
 * Root layout
 *
 * Provider stack (outermost → innermost):
 *   PersistQueryClientProvider  — TanStack Query with persisted cache
 *   AuthProvider                — Supabase session
 *   TrackingProvider            — GPS/sensor context
 *   ToastProvider               — showToast() available everywhere
 *   RootNavigation              — auth guard + biometric lock + OTA banner
 *
 * Status bar: transparent, light content (set once here — never per-screen).
 * Fonts: loaded via expo-font config plugin in app.json (baked into binary).
 *        useFonts() hook is removed; SplashScreen hides after auth resolves.
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { VehicleProvider } from '@/contexts/VehicleContext';
import { TrackingProvider } from '@/contexts/TrackingContext';
import { ToastProvider } from '@/components/ui/Toast';
import { SplashGate } from '@/components/ui/SplashGate';
import { GlobalErrorBoundary } from '@/components/error/GlobalErrorBoundary';
import { BiometricLockScreen } from '@/components/security/BiometricLockScreen';
import { isBiometricLockEnabled, authenticateWithBiometrics } from '@/services/biometrics';
import { Colors } from '@/constants/theme';
import { startOfflineSync, stopOfflineSync } from '@/services/offlineQueue';
import { OfflineSyncBanner } from '@/components/ui/OfflineSyncBanner';
import { useOtaUpdates } from '@/lib/updates';
import { OtaUpdateBanner } from '@/components/ui/OtaUpdateBanner';
import { detectAndSaveLaunchReferral } from '@/services/referrals';
import { queryClient } from '@/lib/queryClient';
import { asyncStoragePersister } from '@/lib/queryPersister';

// Prevent native splash from auto-hiding before auth state resolves
SplashScreen.preventAutoHideAsync().catch(() => {});

// ─────────────────────────────────────────────────────────────────────────────
// Auth guard + app-level logic
// ─────────────────────────────────────────────────────────────────────────────

function RootNavigation() {
  const { status, profile } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isUpdateReady, applyUpdateNow } = useOtaUpdates();

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [checkingLock, setCheckingLock] = useState<boolean>(true);
  const [splashFinished, setSplashFinished] = useState<boolean>(false);

  const isReady = status !== 'loading' && !checkingLock;

  // Hide native splash once auth state is known
  // Fonts are baked via expo-font plugin in app.json
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  // App-level side effects
  useEffect(() => {
    startOfflineSync();
    detectAndSaveLaunchReferral().catch(() => {});
    return () => {
      stopOfflineSync();
    };
  }, []);

  // Biometric app lock
  useEffect(() => {
    async function checkAppLock() {
      if (status !== 'authenticated') {
        setIsLocked(false);
        setCheckingLock(false);
        return;
      }

      const enabled = await isBiometricLockEnabled();
      if (!enabled) {
        setIsLocked(false);
        setCheckingLock(false);
        return;
      }

      setIsLocked(true);
      setCheckingLock(false);

      const authenticated = await authenticateWithBiometrics('Unlock Slipstream');
      if (authenticated) {
        setIsLocked(false);
      }
    }

    if (status !== 'loading') {
      checkAppLock();
    }
  }, [status]);

  // Auth-based routing
  useEffect(() => {
    if (status === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (status === 'authenticated') {
      const hasCompletedOnboarding = Boolean(profile?.display_name);

      if (!hasCompletedOnboarding && profile !== null) {
        if (!inOnboarding) {
          router.replace('/onboarding');
        }
      } else if (hasCompletedOnboarding && (inAuthGroup || inOnboarding || !segments[0])) {
        router.replace('/(tabs)/track');
      }
    } else if (status === 'unauthenticated' && inOnboarding) {
      router.replace('/(auth)/login');
    }
  }, [status, profile, segments, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {isLocked && status === 'authenticated' ? (
        <BiometricLockScreen onUnlock={() => setIsLocked(false)} />
      ) : (
        <>
          {isUpdateReady && <OtaUpdateBanner onRestart={applyUpdateNow} />}
          <OfflineSyncBanner />
          <Slot />
        </>
      )}
      {!splashFinished && (
        <SplashGate isReady={isReady} onFinish={() => setSplashFinished(true)} />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export — provider stack
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <GlobalErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister, maxAge: 24 * 60 * 60 * 1000 }}
      >
        <AuthProvider>
          <PreferencesProvider>
            <VehicleProvider>
              <TrackingProvider>
                <ToastProvider>
                  <RootNavigation />
                </ToastProvider>
              </TrackingProvider>
            </VehicleProvider>
          </PreferencesProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </GlobalErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.bg.base,
  },
});
