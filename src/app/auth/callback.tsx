import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { Icon } from '@/components/ui/Icon';
import { toUserMessage } from '@/utils/toUserMessage';

export default function AuthCallback() {
  const router = useRouter();
  const [statusText, setStatusText] = useState('Verifying credentials...');
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function handleAuthRedirect(url: string | null) {
      if (!url) return;

      try {
        const parsed = Linking.parse(url);

        // 1. Authorization Code Exchange (PKCE)
        if (parsed.queryParams?.code) {
          setStatusText('Completing secure sign-in...');
          const { error } = await supabase.auth.exchangeCodeForSession(
            String(parsed.queryParams.code),
          );
          if (error) throw error;
        }

        // 2. Token Fragment (#access_token=...&refresh_token=...)
        if (url.includes('#access_token=') || url.includes('?access_token=')) {
          setStatusText('Activating session...');
          const fragment = url.split('#')[1] || url.split('?')[1];
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }

        if (isMounted) {
          setStatusText('Welcome to Slipstream!');
          setTimeout(() => {
            router.replace('/(tabs)/track');
          }, 400);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = toUserMessage(err);
        setErrorText(msg);
        setTimeout(() => {
          router.replace('/(tabs)/profile');
        }, 2500);
      }
    }

    // Check initial deep link that opened the app
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && initialUrl.includes('auth/callback')) {
        handleAuthRedirect(initialUrl);
      }
    });

    // Listen to deep links while app is foregrounded
    const subscription = Linking.addEventListener('url', (event) => {
      if (event.url && event.url.includes('auth/callback')) {
        handleAuthRedirect(event.url);
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>SLIPSTREAM</Text>
      {errorText ? (
        <View style={styles.card}>
          <Icon name="warning" size={36} color={Colors.accentRed} weight="duotone" />
          <Text style={styles.errorTitle}>Sign-in issue</Text>
          <Text style={styles.errorSub}>{errorText}</Text>
          <Text style={styles.redirectSub}>Returning to profile...</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <ActivityIndicator size="large" color={Colors.accentCyan} />
          <Text style={styles.statusText}>{statusText}</Text>
          <Text style={styles.captionText}>Setting up your telemetry & garage</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  logo: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.accentCyan,
    letterSpacing: 3,
    marginBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
    gap: Spacing.md,
  },
  statusText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  captionText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.accentRed,
  },
  errorSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  redirectSub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
});
