/**
 * Slipstream Over-the-Air (OTA) Updates Engine & Hook
 *
 * Fully resilient, non-blocking telemetry update engine.
 * Never throws or crashes the app if offline or if EAS update services are unreachable.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

const THROTTLE_MS = 5 * 60 * 1000; // 5 minutes between active checks

export interface DiagnosticsInfo {
  channel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  createdAt: string | null;
  isEmbeddedLaunch: boolean;
  isEnabled: boolean;
  isEmergencyLaunch: boolean;
  lastCheckTime: string | null;
  lastStatus: 'idle' | 'checking' | 'downloading' | 'ready' | 'up-to-date' | 'error';
  lastError: string | null;
}

export function useOtaUpdates() {
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsInfo>(() => ({
    channel: Updates.channel ?? null,
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId: Updates.updateId ?? null,
    createdAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEnabled: Updates.isEnabled,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
    lastCheckTime: null,
    lastStatus: 'idle',
    lastError: null,
  }));

  const lastCheckTimestampRef = useRef<number>(0);
  const isRunningRef = useRef(false);

  const performCheckAndFetch = useCallback(async (forced = false) => {
    // Skip in development or when expo-updates is disabled
    if (__DEV__ || !Updates.isEnabled) {
      setDiagnostics((prev) => ({
        ...prev,
        lastStatus: 'idle',
        lastError: !Updates.isEnabled ? 'Updates disabled' : 'DEV mode (bypassed)',
      }));
      return;
    }

    const now = Date.now();
    if (!forced && now - lastCheckTimestampRef.current < THROTTLE_MS) {
      return;
    }
    if (isRunningRef.current) {
      return;
    }

    isRunningRef.current = true;
    lastCheckTimestampRef.current = now;
    setIsChecking(true);

    setDiagnostics((prev) => ({
      ...prev,
      lastCheckTime: new Date(now).toLocaleTimeString(),
      lastStatus: 'checking',
      lastError: null,
    }));

    try {
      const checkResult = await Updates.checkForUpdateAsync();

      if (checkResult.isAvailable) {
        setDiagnostics((prev) => ({ ...prev, lastStatus: 'downloading' }));
        const fetchResult = await Updates.fetchUpdateAsync();

        if (fetchResult.isNew) {
          setIsUpdateReady(true);
          setDiagnostics((prev) => ({
            ...prev,
            lastStatus: 'ready',
          }));
        } else {
          setDiagnostics((prev) => ({ ...prev, lastStatus: 'up-to-date' }));
        }
      } else {
        setDiagnostics((prev) => ({ ...prev, lastStatus: 'up-to-date' }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      // Log for telemetry, never crash the host application
      console.warn('[UpdatesEngine] OTA Check/Fetch failed:', message);
      setDiagnostics((prev) => ({
        ...prev,
        lastStatus: 'error',
        lastError: message,
      }));
    } finally {
      isRunningRef.current = false;
      setIsChecking(false);
    }
  }, []);

  const applyUpdateNow = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (err: unknown) {
      console.error('[UpdatesEngine] reloadAsync error:', err);
    }
  }, []);

  useEffect(() => {
    // Initial check on app mount
    performCheckAndFetch(false);

    // Check on every foreground transition
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        performCheckAndFetch(false);
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [performCheckAndFetch]);

  return {
    isUpdateReady,
    isChecking,
    diagnostics,
    checkForUpdate: () => performCheckAndFetch(true),
    applyUpdateNow,
  };
}
