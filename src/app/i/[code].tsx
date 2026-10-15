import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/design';
import { savePendingReferralCode } from '@/services/referrals';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function InviteRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { status } = useAuth();

  const [inviterName, setInviterName] = useState<string | null>(null);
  const [checkingInviter, setCheckingInviter] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  const cleanCode = typeof code === 'string' ? code.trim().toUpperCase() : '';

  useEffect(() => {
    // Web attribution cookie persistence
    if (Platform.OS === 'web' && cleanCode && typeof document !== 'undefined') {
      try {
        document.cookie = `slipstream_invite_code=${cleanCode}; path=/; max-age=2592000; SameSite=Lax; Secure`;
      } catch {
        // Silently continue if cookies are blocked
      }
    }

    async function loadInviter() {
      if (!cleanCode) {
        setCheckingInviter(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('referral_code', cleanCode)
          .maybeSingle();

        if (!error && data?.display_name) {
          setInviterName(data.display_name.trim());
        }
      } catch {
        // Graceful fallback for unknown/expired codes (never 404)
      } finally {
        setCheckingInviter(false);
      }
    }

    loadInviter();
  }, [cleanCode]);

  useEffect(() => {
    // Native mobile app handling (Universal link or deep link opened directly in-app)
    if (Platform.OS !== 'web') {
      async function processNativeInvite() {
        if (cleanCode) {
          await savePendingReferralCode(cleanCode);

          if (status === 'unauthenticated') {
            router.replace({
              pathname: '/(auth)/login',
              params: { mode: 'signup', referralCode: cleanCode },
            });
          } else if (status === 'authenticated') {
            router.replace('/(tabs)/track');
          }
        } else {
          router.replace('/(auth)/login');
        }
      }

      if (status !== 'loading') {
        processNativeInvite();
      }
    }
  }, [cleanCode, status, router]);

  // For native apps while loading/redirecting
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accentCyan} />
        <Text style={styles.loadingText}>Activating driver invite...</Text>
      </View>
    );
  }

  // Web Landing Page
  const playStoreUrl = `https://play.google.com/store/apps/details?id=com.slipstream.app&referrer=invite_${encodeURIComponent(cleanCode || 'SLIPSTREAM')}`;
  const appStoreUrl = 'https://apps.apple.com/app/com.slipstream.app/id6470000000';
  const deepLink = cleanCode ? `slipstream://i/${cleanCode}` : 'slipstream://';

  const handleCopyCode = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(cleanCode || 'SLIPSTREAM');
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // clipboard permission denied
      }
    }
  };

  const handleOpenApp = () => {
    Linking.openURL(deepLink).catch(() => {
      // If app is not installed, prompt to download
      Linking.openURL(playStoreUrl);
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.webContainer}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <View style={styles.pulseDot} />
          <Text style={styles.badgeText}>Slipstream Telemetry</Text>
        </View>

        <Text style={styles.heroTitle}>
          {checkingInviter ? (
            'Driver Invitation'
          ) : inviterName ? (
            <>
              <Text style={styles.accentText}>{inviterName}</Text> invited you to race
            </>
          ) : (
            'Join Slipstream Telemetry'
          )}
        </Text>

        <Text style={styles.leadText}>
          Precision GPS telemetry, 0-100 & 1/4-mile drag timer, live speed camera radar alerts, and track day sessions.
        </Text>

        <View style={styles.codeBox}>
          <View>
            <Text style={styles.codeLabel}>DRIVER INVITE CODE</Text>
            <Text style={styles.codeValue}>{cleanCode || 'SLIPSTREAM'}</Text>
          </View>
          <Pressable style={styles.copyBtn} onPress={handleCopyCode}>
            <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
          </Pressable>
        </View>

        <View style={styles.featuresGrid}>
          <View style={styles.featureItem}>
            <Text style={styles.featureTitle}>Drag Timer</Text>
            <Text style={styles.featureDesc}>0-60, 0-100 & 1/4 mile runs with 0.01s GPS precision.</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureTitle}>Radar Hazards</Text>
            <Text style={styles.featureDesc}>Live speed camera zones, red-light traps, and highway alerts.</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureTitle}>Track Day</Text>
            <Text style={styles.featureDesc}>Automatic lap trigger, delta split telemetry, and sector pace.</Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureTitle}>Garage Logs</Text>
            <Text style={styles.featureDesc}>Digital maintenance logbook, tire wear, and vehicle service.</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => Linking.openURL(playStoreUrl)}
          >
            <Text style={styles.btnPrimaryText}>Get on Google Play (Passes Code)</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => Linking.openURL(appStoreUrl)}
          >
            <Text style={styles.btnSecondaryText}>Download on App Store</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, styles.btnApp]}
            onPress={handleOpenApp}
          >
            <Text style={styles.btnAppText}>Open in Slipstream App</Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          Slipstream Motorsport Telemetry &middot; Code preserved for signup
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  webContainer: {
    flexGrow: 1,
    backgroundColor: '#080B14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    maxWidth: 500,
    width: '100%',
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accentCyan,
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    color: Colors.accentCyan,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  accentText: {
    color: Colors.accentCyan,
  },
  leadText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  codeBox: {
    width: '100%',
    backgroundColor: '#151C30',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.3)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  codeLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  codeValue: {
    fontFamily: FontFamily.number,
    fontSize: FontSize.h2,
    fontWeight: '700',
    color: Colors.accentOrange,
    letterSpacing: 2,
    marginTop: 2,
  },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1E293B',
    borderRadius: Radius.sm,
  },
  copyBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.textPrimary,
  },
  featuresGrid: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  featureItem: {
    backgroundColor: '#121829',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  featureTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.accentCyan,
  },
  btnPrimaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: '#080B14',
  },
  btnSecondary: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnSecondaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  btnApp: {
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.3)',
  },
  btnAppText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.accentOrange,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
