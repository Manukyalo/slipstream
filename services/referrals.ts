/**
 * Referral & Invite Service
 *
 * Handles referral code generation, native share sheet triggers,
 * deep link generation (drivetrack.app/i/{code}), persistence of pending invite codes,
 * and server attribution via Supabase RPC.
 */

import { Share, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Constants & Types
// ---------------------------------------------------------------------------

const PENDING_REFERRAL_KEY = 'slipstream_pending_referral_code';
export const REFERRAL_DOMAIN = 'drivetrack.app';

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

// ---------------------------------------------------------------------------
// Link & Share Helpers
// ---------------------------------------------------------------------------

export function getReferralDeepLink(code: string): string {
  const clean = code.trim().toUpperCase();
  return `https://${REFERRAL_DOMAIN}/i/${clean}`;
}

export async function shareReferralInvite(code: string): Promise<boolean> {
  const clean = code.trim().toUpperCase();
  const link = getReferralDeepLink(clean);
  const message = `Join me on Slipstream — precision telemetry, drag timer & live radar alerts. Use my driver invite link to get started: ${link}`;

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
