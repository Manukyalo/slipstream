import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { TrackingProvider } from '@/contexts/TrackingContext';
import { SplashGate } from '@/components/ui/SplashGate';
import { BiometricLockScreen } from '@/components/security/BiometricLockScreen';
import { isBiometricLockEnabled, authenticateWithBiometrics } from '@/services/biometrics';
import { Colors } from '@/constants/design';
import { startOfflineSync, stopOfflineSync } from '@/services/offlineQueue';
import { OfflineSyncBanner } from '@/components/ui/OfflineSyncBanner';
import { useOtaUpdates } from '@/lib/updates';
import { OtaUpdateBanner } from '@/components/ui/OtaUpdateBanner';

// Prevent native splash screen from autohiding before resources/session ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigation() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { isUpdateReady, applyUpdateNow } = useOtaUpdates();

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [checkingLock, setCheckingLock] = useState<boolean>(true);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    startOfflineSync();
    return () => {
      stopOfflineSync();
    };
  }, []);

  // Biometric app lock check on app start
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

      // Prompt immediately on foreground
      const authenticated = await authenticateWithBiometrics('Unlock Slipstream');
      if (authenticated) {
        setIsLocked(false);
      }
    }

    if (status !== 'loading') {
      checkAppLock();
    }
  }, [status]);

  useEffect(() => {
    if (status === 'loading' || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Only push authenticated users out of the login/signup screens
    // Unauthenticated users can freely use the app; auth is in Settings tab
    if (status === 'authenticated' && (inAuthGroup || !segments[0])) {
      router.replace('/(tabs)/track');
    }
  }, [status, segments, fontsLoaded, router]);

  if (!fontsLoaded || status === 'loading' || checkingLock) {
    return <SplashGate />;
  }

  if (isLocked && status === 'authenticated') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <BiometricLockScreen onUnlock={() => setIsLocked(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {isUpdateReady && <OtaUpdateBanner onRestart={applyUpdateNow} />}
      <OfflineSyncBanner />
      <Slot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <TrackingProvider>
        <RootNavigation />
      </TrackingProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
});
