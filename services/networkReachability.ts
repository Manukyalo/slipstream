/**
 * Network Reachability Service
 *
 * Implements strict connectivity verification:
 * - NetInfo isConnected + isInternetReachable
 * - Confirmed by active lightweight ping to Supabase rest endpoint (2500ms timeout)
 * - 3-second debounce before declaring truly offline
 * - Never shows offline if reachability ping succeeds
 * - Automatically triggers flushQueue() when connectivity returns
 * - Emits a transient 'synced' state when buffered records are successfully flushed
 */

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { subscribeToQueueStatus, flushQueue } from '@/services/offlineQueue';

export interface ReachabilityState {
  isTrulyOffline: boolean;
  pendingCount: number;
  justSynced: boolean;
}

type ReachabilityListener = (state: ReachabilityState) => void;

const listeners = new Set<ReachabilityListener>();

let isTrulyOffline = false;
let pendingCount = 0;
let justSynced = false;
let offlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncedDismissTimer: ReturnType<typeof setTimeout> | null = null;
let isStarted = false;
let prevPendingCount = 0;

function notify() {
  const state: ReachabilityState = {
    isTrulyOffline,
    pendingCount,
    justSynced,
  };
  listeners.forEach((fn) => fn(state));
}

/**
 * Lightweight active ping to Supabase to verify true Internet reachability
 */
async function checkSupabaseReachability(): Promise<boolean> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://zzfjvhbuhsugwztllxco.supabase.co';
  const pingUrl = `${supabaseUrl}/rest/v1/`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(pingUrl, {
      method: 'HEAD',
      headers: {
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Any HTTP response (200, 401, etc.) indicates the network reaches Supabase
    return res.status > 0;
  } catch {
    return false;
  }
}

async function handleNetworkChange(state: NetInfoState) {
  const seemsOffline = !state.isConnected || state.isInternetReachable === false;

  if (seemsOffline) {
    // If already waiting on debounce, let it run
    if (offlineDebounceTimer) return;

    offlineDebounceTimer = setTimeout(async () => {
      offlineDebounceTimer = null;
      // Confirm with active probe before declaring offline
      const canReachServer = await checkSupabaseReachability();
      if (!canReachServer) {
        if (!isTrulyOffline) {
          isTrulyOffline = true;
          notify();
        }
      } else {
        if (isTrulyOffline) {
          isTrulyOffline = false;
          notify();
        }
      }
    }, 3000);
  } else {
    // Clear any pending offline timer
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }

    const wasOffline = isTrulyOffline;
    isTrulyOffline = false;
    notify();

    // If we reconnected, immediately attempt to flush queued telemetry
    if (wasOffline || pendingCount > 0) {
      void flushQueue().catch((err) => {
        console.warn('[Reachability] Auto-flush error on reconnect:', err);
      });
    }
  }
}

export function startReachabilityMonitoring(): void {
  if (isStarted) return;
  isStarted = true;

  // Listen to NetInfo
  NetInfo.addEventListener(handleNetworkChange);

  // Initial check
  NetInfo.fetch().then(handleNetworkChange).catch(() => {});

  // Listen to SQLite offline queue status
  subscribeToQueueStatus((_status, count) => {
    if (prevPendingCount > 0 && count === 0 && !isTrulyOffline) {
      // Transition from pending > 0 to 0 while online -> trigger quiet 'Synced' toast
      justSynced = true;
      notify();

      if (syncedDismissTimer) clearTimeout(syncedDismissTimer);
      syncedDismissTimer = setTimeout(() => {
        justSynced = false;
        notify();
      }, 2500);
    }

    prevPendingCount = count;
    pendingCount = count;
    notify();
  });
}

export function subscribeToReachability(listener: ReachabilityListener): () => void {
  startReachabilityMonitoring();
  listeners.add(listener);
  listener({ isTrulyOffline, pendingCount, justSynced });
  return () => {
    listeners.delete(listener);
  };
}

export function getReachabilityState(): ReachabilityState {
  return { isTrulyOffline, pendingCount, justSynced };
}
