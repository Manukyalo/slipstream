import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchUserReferralStats,
  shareReferralInvite,
  type ReferralStats,
} from '@/services/referrals';

export interface UseReferralReturn {
  referralCode: string | null;
  totalReferrals: number;
  isLoading: boolean;
  error: string | null;
  shareInvite: () => Promise<boolean>;
  refreshStats: () => Promise<void>;
}

export function useReferral(): UseReferralReturn {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await fetchUserReferralStats(user.id);
      setStats(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load referral info';
      setError(msg);
      // Fallback: If profile has referral_code already loaded in AuthContext
      if (profile?.referral_code) {
        setStats({ referralCode: profile.referral_code, totalReferrals: 0 });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile?.referral_code]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleShare = useCallback(async (): Promise<boolean> => {
    const code = stats?.referralCode || profile?.referral_code;
    if (!code) return false;
    return shareReferralInvite(code);
  }, [stats?.referralCode, profile?.referral_code]);

  return {
    referralCode: stats?.referralCode || profile?.referral_code || null,
    totalReferrals: stats?.totalReferrals ?? 0,
    isLoading,
    error,
    shareInvite: handleShare,
    refreshStats: loadStats,
  };
}
