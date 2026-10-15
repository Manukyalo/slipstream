/**
 * Network Diagnostic Utility — Phase 7
 *
 * Probes device connectivity and tests Supabase host resolution
 * to identify whether issues stem from device network, DNS, or server availability.
 */

import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@/lib/supabase';

export interface NetworkDiagnosticResult {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: string;
  supabaseHost: string;
  canReachSupabase: boolean;
  latencyMs: number | null;
  errorDetail: string | null;
  checkedAt: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://zzfjvhbuhsugwztllxco.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Extract hostname from URL for reporting */
export function getSupabaseHost(): string {
  try {
    const url = new URL(SUPABASE_URL);
    return url.hostname;
  } catch {
    return SUPABASE_URL.replace(/^https?:\/\//, '').split('/')[0] ?? 'unknown';
  }
}

/**
 * Perform a full diagnostic check:
 * 1. Read device NetInfo state.
 * 2. Ping Supabase REST root with a 4-second timeout.
 * 3. Return a structured diagnostic report.
 */
export async function runNetworkDiagnostic(): Promise<NetworkDiagnosticResult> {
  const host = getSupabaseHost();
  const netState = await NetInfo.fetch();

  const isConnected = Boolean(netState.isConnected);
  const isInternetReachable = netState.isInternetReachable;
  const connectionType = netState.type;

  if (!isConnected) {
    return {
      isConnected: false,
      isInternetReachable: false,
      connectionType,
      supabaseHost: host,
      canReachSupabase: false,
      latencyMs: null,
      errorDetail: 'Device network interface is disconnected (Airplane mode or no Wi-Fi/Cellular).',
      checkedAt: new Date().toISOString(),
    };
  }

  // Probe Supabase REST endpoint
  const startTime = Date.now();
  let canReachSupabase = false;
  let latencyMs: number | null = null;
  let errorDetail: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    latencyMs = Date.now() - startTime;
    // Any HTTP status (even 401/404/200) means DNS resolved and host is reached!
    canReachSupabase = res.status > 0;
  } catch (err: unknown) {
    latencyMs = Date.now() - startTime;
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        errorDetail = `Connection timed out after 4000 ms to ${host}`;
      } else {
        errorDetail = err.message;
      }
    } else {
      errorDetail = 'Unknown fetch error';
    }
  }

  return {
    isConnected,
    isInternetReachable,
    connectionType,
    supabaseHost: host,
    canReachSupabase,
    latencyMs: canReachSupabase ? latencyMs : null,
    errorDetail,
    checkedAt: new Date().toISOString(),
  };
}
