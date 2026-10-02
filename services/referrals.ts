/**
 * Referral & Invite Service
 *
 * Handles referral code generation, native share sheet triggers,
 * deep link generation (${APP_BASE_URL}/i/{code}), persistence of pending invite codes,
 * and server attribution via Supabase RPC.
 */

import { Share, Platform, Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

const PENDING_REFERRAL_KEY = 'slipstream_pending_referral_code';

// Configurable base URL: EXPO_PUBLIC_APP_URL -> NEXT_PUBLIC_APP_URL -> Vercel fallback
export const APP_BASE_URL = (
  process.env.EXPO_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://slipstream-app.vercel.app'
).replace(/\/+$/, '');

export const APP_DOMAIN = APP_BASE_URL.replace(/^https?:\/\//, '');

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
}

export interface ClaimReferralResult {
  success: boolean;
  error?: string;
  referrerId?: string;
}

// ---------------------------------------------------------------------------
// Pending Referral Code Storage (Persisted across deep-link app opens)
// ---------------------------------------------------------------------------

export async function savePendingReferralCode(code: string): Promise<void> {
  const clean = code.trim().toUpperCase();
  if (!clean) return;
  try {
    await SecureStore.setItemAsync(PENDING_REFERRAL_KEY, clean);
  } catch (err) {
    console.warn('[Referrals] Failed to save pending referral code:', err);
  }
}

export async function getPendingReferralCode(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(PENDING_REFERRAL_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingReferralCode(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PENDING_REFERRAL_KEY);
  } catch (err) {
    console.warn('[Referrals] Failed to clear pending referral code:', err);
  }
}

/**
 * Parses a deep link, universal link, or store referrer parameter to extract an invite code.
 */
export function extractReferralFromUrl(url: string): string | null {
  try {
    // Check path /i/CODE
    const pathMatch = url.match(/\/i\/([a-zA-Z0-9_-]+)/i);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1].trim().toUpperCase();
    }

    // Check query params: referrer=invite_CODE or referralCode=CODE
    const queryIdx = url.indexOf('?');
    if (queryIdx !== -1) {
      const query = url.substring(queryIdx + 1);
      const params = new URLSearchParams(query);

      const referrer = params.get('referrer');
      if (referrer) {
        const inviteMatch = referrer.match(/invite_([a-zA-Z0-9_-]+)/i);
        if (inviteMatch && inviteMatch[1]) {
          return inviteMatch[1].trim().toUpperCase();
        }
      }

      const refCode = params.get('referralCode') || params.get('ref') || params.get('code');
      if (refCode) {
        return refCode.trim().toUpperCase();
      }
    }
  } catch {
    // Malformed URL
  }
  return null;
}

/**
 * Detects referral codes from initial launch URL (deep link, universal link, or store referrer parameter)
 * or web cookies, and saves it into pending referral storage.
 */
export async function detectAndSaveLaunchReferral(): Promise<string | null> {
  // 1. Check if already saved in SecureStore
  const existing = await getPendingReferralCode();
  if (existing) return existing;

  // 2. Check web cookies if running on web
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const match = document.cookie.match(/slipstream_invite_code=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      const code = match[1].trim().toUpperCase();
      await savePendingReferralCode(code);
      return code;
    }
  }

  // 3. Inspect initial launch URL
  try {
    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      const parsedCode = extractReferralFromUrl(initialUrl);
      if (parsedCode) {
        await savePendingReferralCode(parsedCode);
        return parsedCode;
      }
    }
  } catch (err) {
    console.warn('[Referrals] Error checking initial URL:', err);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Link & Share Helpers
// ---------------------------------------------------------------------------

export function getReferralDeepLink(code: string): string {
  const clean = code.trim().toUpperCase();
  return `${APP_BASE_URL}/i/${clean}`;
}

export async function shareReferralInvite(code: string): Promise<boolean> {
  const clean = code.trim().toUpperCase();
  const link = getReferralDeepLink(clean);
  const message = `Join me on Slipstream: precision telemetry, drag timer & live radar alerts. Use my driver invite link to get started: ${link}`;

  try {
    const result = await Share.share(
      Platform.select({
        ios: {
          title: 'Slipstream Driver Invite',
          url: link,
          message,
        },
        default: {
          title: 'Slipstream Driver Invite',
          message,
        },
      }),
    );

    return result.action === Share.sharedAction;
  } catch (err) {
    console.error('[Referrals] Share sheet error:', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// API / Database Operations
// ---------------------------------------------------------------------------

export async function fetchUserReferralStats(userId: string): Promise<ReferralStats> {
  // 1. Fetch user's profile to get referral code
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .single();

  if (profileErr) {
    throw new Error(`Failed to load profile referral code: ${profileErr.message}`);
  }

  const referralCode = profile?.referral_code ?? 'DRIVE1';

  // 2. Count total drivers referred
  const { count, error: countErr } = await supabase
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', userId);

  if (countErr) {
    console.warn('[Referrals] Failed to count referrals:', countErr.message);
  }

  return {
    referralCode,
    totalReferrals: count ?? 0,
  };
}

export async function claimReferralCode(rawCode: string): Promise<ClaimReferralResult> {
  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: 'Referral code cannot be blank.' };
  }

  const { data, error } = await supabase.rpc('claim_referral_code', {
    referral_code_input: cleanCode,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const res = data as { success: boolean; error?: string; referrer_id?: string };
  if (!res || !res.success) {
    return { success: false, error: res?.error ?? 'Invalid referral code.' };
  }

  return { success: true, referrerId: res.referrer_id };
}
