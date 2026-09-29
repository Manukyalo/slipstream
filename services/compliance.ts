import { supabase } from '@/lib/supabase';
import * as SecureStore from 'expo-secure-store';

const LOCATION_CONSENT_KEY = 'slipstream_background_location_consent_v1';
const BIOMETRIC_ENABLED_KEY = 'slipstream_biometrics_enabled_v1';

export interface UserDataExport {
  export_version: string;
  exported_at: string;
  user_id: string;
  profile: Record<string, unknown> | null;
  vehicles: Array<Record<string, unknown>>;
  trips: Array<Record<string, unknown>>;
  drag_runs: Array<Record<string, unknown>>;
  hazards_reported: Array<Record<string, unknown>>;
  referrals: Array<Record<string, unknown>>;
}

/**
 * Checks if the user has explicitly consented to background location tracking.
 */
export async function hasUserConsentedLocation(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(LOCATION_CONSENT_KEY);
    return val === 'true';
  } catch (error) {
    console.warn('[Compliance] Error reading location consent flag:', error);
    return false;
  }
}

/**
 * Records explicit consent for background location tracking.
 */
export async function setUserLocationConsent(consented: boolean): Promise<void> {
  try {
    if (consented) {
      await SecureStore.setItemAsync(LOCATION_CONSENT_KEY, 'true');
    } else {
      await SecureStore.deleteItemAsync(LOCATION_CONSENT_KEY);
    }
  } catch (error) {
    console.warn('[Compliance] Error saving location consent flag:', error);
  }
}

/**
 * Exports complete account data for GDPR/CCPA data portability.
 */
export async function exportUserData(): Promise<{ data: UserDataExport | null; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('export_user_data');
    if (error) {
      return { data: null, error: error.message };
    }
    return { data: (data as unknown) as UserDataExport, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to export user data';
    return { data: null, error: msg };
  }
}

/**
 * Deletes the authenticated user account and all associated telemetry, vehicles, and records.
 */
export async function deleteUserAccount(): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('delete_user_account');
    if (error) {
      return { success: false, error: error.message };
    }

    // Clear local secrets upon deletion
    await SecureStore.deleteItemAsync(LOCATION_CONSENT_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY).catch(() => {});

    // Sign out client session
    await supabase.auth.signOut();

    return { success: !!data, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete user account';
    return { success: false, error: msg };
  }
}

/**
 * Scheduled or manual invocation of the 30-day speed sample retention purge.
 */
export async function purgeOldSpeedSamples(daysOld: number = 30): Promise<{ purgedCount: number; error: string | null }> {
  try {
    const { data, error } = await supabase.rpc('purge_old_speed_samples', {
      p_days_old: daysOld,
    });
    if (error) {
      return { purgedCount: 0, error: error.message };
    }
    return { purgedCount: (data as number) ?? 0, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to purge speed samples';
    return { purgedCount: 0, error: msg };
  }
}
