import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { savePendingReferralCode } from '@/services/referrals';
import { useAuth } from '@/contexts/AuthContext';

export default function InviteRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { status } = useAuth();

  useEffect(() => {
    async function processInvite() {
      if (code && typeof code === 'string') {
        const cleanCode = code.trim().toUpperCase();
        await savePendingReferralCode(cleanCode);

        // If user is unauthenticated, route straight to signup with pre-filled code
        if (status === 'unauthenticated') {
          router.replace({
            pathname: '/(auth)/login',
            params: { mode: 'signup', referralCode: cleanCode },
          });
        } else if (status === 'authenticated') {
          // If already authenticated, redirect to garage/settings or track
          router.replace('/(tabs)/track');
        }
      } else {
        router.replace('/(auth)/login');
      }
    }

    if (status !== 'loading') {
      processInvite();
    }
  }, [code, status, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accentCyan} />
      <Text style={styles.text}>Activating driver invite...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  text: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
