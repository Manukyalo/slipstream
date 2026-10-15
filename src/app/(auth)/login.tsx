/**
 * LoginScreen — Phase 2 Rebuilt Sign-In
 *
 * Requirements:
 *  1. Mark, "Join the grid", one line of value.
 *  2. Stacked buttons: Continue with Apple (iOS), Continue with Google (official multicolour logo), Continue with email (outline).
 *  3. Consent line linking Terms and Privacy (env vars).
 *  4. Benefits: 2x3 grid of Phosphor icon chips (No emojis).
 *  5. Passwordless email OTP flow with 60s resend timer and inline validation.
 *  6. Error handling via toUserMessage().
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
  KeyboardAvoidingView,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { IconChip } from '@/components/ui/IconChip';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { GoogleLogo } from '@/components/ui/GoogleLogo';
import { useAuth } from '@/contexts/AuthContext';
import { toUserMessage } from '@/utils/toUserMessage';
import { detectAndSaveLaunchReferral, claimReferralCode, clearPendingReferralCode } from '@/services/referrals';

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://slipstream.app/terms';
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://slipstream.app/privacy';

const BENEFITS = [
  { id: 'tracking', label: 'Live tracking', icon: 'speedometer' as const, color: 'cyan' as const },
  { id: 'drag', label: 'Drag timing', icon: 'timer' as const, color: 'warning' as const },
  { id: 'lap', label: 'Lap timing', icon: 'flag' as const, color: 'violet' as const },
  { id: 'leaderboards', label: 'Leaderboards', icon: 'trophy' as const, color: 'success' as const },
  { id: 'roads', label: 'Roads', icon: 'path' as const, color: 'blue' as const },
  { id: 'maintenance', label: 'Maintenance', icon: 'gear' as const, color: 'default' as const },
];

const RESEND_COOLDOWN_SECONDS = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple, sendEmailOtp, verifyEmailOtp } = useAuth();

  const [appleAvailable, setAppleAvailable] = useState<boolean>(false);
  const [emailMode, setEmailMode] = useState<boolean>(false);
  const [emailStep, setEmailStep] = useState<'input' | 'otp'>('input');
  const [email, setEmail] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(false);
  const [appleLoading, setAppleLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState<number>(0);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check Apple Auth availability on mount
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  // Detect pending referral code
  useEffect(() => {
    detectAndSaveLaunchReferral().then((code) => {
      if (code) setReferralCode(code);
    }).catch(() => {});
  }, []);

  // Handle resend countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer]);

  const handleAppleSignIn = async () => {
    setErrorMessage(null);
    setAppleLoading(true);
    try {
      const err = await signInWithApple();
      if (err) {
        setErrorMessage(toUserMessage(err));
      } else if (referralCode) {
        claimReferralCode(referralCode).catch(() => {});
        clearPendingReferralCode().catch(() => {});
      }
    } catch (e) {
      setErrorMessage(toUserMessage(e));
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setGoogleLoading(true);
    try {
      const err = await signInWithGoogle();
      if (err) {
        setErrorMessage(toUserMessage(err));
      } else if (referralCode) {
        claimReferralCode(referralCode).catch(() => {});
        clearPendingReferralCode().catch(() => {});
      }
    } catch (e) {
      setErrorMessage(toUserMessage(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);
    try {
      const err = await sendEmailOtp(trimmed);
      if (err) {
        setErrorMessage(toUserMessage(err));
      } else {
        setEmailStep('otp');
        setResendTimer(RESEND_COOLDOWN_SECONDS);
      }
    } catch (e) {
      setErrorMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otpCode.trim();
    if (!code || code.length < 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);
    try {
      const err = await verifyEmailOtp(email.trim().toLowerCase(), code);
      if (err) {
        setErrorMessage(toUserMessage(err));
      } else if (referralCode) {
        claimReferralCode(referralCode).catch(() => {});
        clearPendingReferralCode().catch(() => {});
      }
    } catch (e) {
      setErrorMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (resendTimer > 0 || loading) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      const err = await sendEmailOtp(email.trim().toLowerCase());
      if (err) {
        setErrorMessage(toUserMessage(err));
      } else {
        setResendTimer(RESEND_COOLDOWN_SECONDS);
      }
    } catch (e) {
      setErrorMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }, [email, resendTimer, loading, sendEmailOtp]);

  const openUrl = (url: string) => {
    Linking.openURL(url).catch((err) => console.warn('[Login] Cannot open URL:', err));
  };

  return (
    <ScreenContainer scrollable contentStyle={styles.scrollContent}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        {/* ── Brand Header ── */}
        <View style={styles.brandHeader}>
          <Image
            source={require('../../../assets/splash-mark.png')}
            style={styles.markImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Join the grid</Text>
          <Text style={styles.subtitle}>
            Precision telemetry, drag timing, and social leaderboards.
          </Text>
        </View>

        {/* ── Referral Pill (if invite link detected) ── */}
        {referralCode ? (
          <View style={styles.referralPill}>
            <Icon name="seal-check" size={16} color={Colors.accent.cyan} weight="fill" />
            <Text style={styles.referralText}>
              VIP Driver invite applied:{' '}
              <Text style={styles.referralCode}>{referralCode}</Text>
            </Text>
          </View>
        ) : null}

        {/* ── Error Banner ── */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Icon name="warning" size={18} color={Colors.semantic.danger} weight="bold" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* ── 2 x 3 Benefits Grid ── */}
        {!emailMode && (
          <View style={styles.benefitsCard}>
            <View style={styles.benefitsGrid}>
              {BENEFITS.map((item) => (
                <View key={item.id} style={styles.benefitItem}>
                  <IconChip
                    name={item.icon}
                    color={item.color}
                    size={18}
                    chipSize={36}
                  />
                  <Text style={styles.benefitLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Action Section ── */}
        {!emailMode ? (
          <View style={styles.buttonStack}>
            {/* Apple Sign-In (iOS) */}
            {appleAvailable && (
              <TouchableOpacity
                style={[styles.appleButton, appleLoading && styles.btnDisabled]}
                onPress={handleAppleSignIn}
                activeOpacity={0.85}
                disabled={appleLoading}
              >
                {appleLoading ? (
                  <ActivityIndicator color="#05070D" />
                ) : (
                  <View style={styles.btnRow}>
                    <Icon name="user" size={18} color="#05070D" weight="fill" />
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Google Sign-In */}
            <TouchableOpacity
              style={[styles.googleButton, googleLoading && styles.btnDisabled]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.85}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.text.primary} />
              ) : (
                <View style={styles.btnRow}>
                  <GoogleLogo size={20} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Email Sign-In (Outline) */}
            <TouchableOpacity
              style={styles.emailButton}
              onPress={() => {
                setErrorMessage(null);
                setEmailMode(true);
                setEmailStep('input');
              }}
              activeOpacity={0.85}
            >
              <View style={styles.btnRow}>
                <Icon name="user-circle" size={18} color={Colors.text.primary} />
                <Text style={styles.emailButtonText}>Continue with email</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Passwordless Email OTP Flow ── */
          <View style={styles.otpCard}>
            <View style={styles.otpHeader}>
              <Text style={styles.otpTitle}>
                {emailStep === 'input' ? 'Sign in with email' : 'Verify code'}
              </Text>
              <Text style={styles.otpSubtitle}>
                {emailStep === 'input'
                  ? "We'll send a 6-digit one-time code. No passwords."
                  : `Enter the code sent to ${email}`}
              </Text>
            </View>

            {emailStep === 'input' ? (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Email address</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="driver@slipstream.app"
                  placeholderTextColor={Colors.text.tertiary}
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />

                <Button
                  variant="primary"
                  loading={loading}
                  onPress={handleSendOtp}
                  style={styles.formButton}
                >
                  Send code
                </Button>

                <TouchableOpacity
                  style={styles.backOption}
                  onPress={() => {
                    setEmailMode(false);
                    setErrorMessage(null);
                  }}
                >
                  <Text style={styles.backOptionText}>Back to all options</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>6-digit code</Text>
                <TextInput
                  style={[styles.textInput, styles.otpInput]}
                  placeholder="123456"
                  placeholderTextColor={Colors.text.tertiary}
                  value={otpCode}
                  onChangeText={(val) => {
                    setOtpCode(val.replace(/\D/g, '').slice(0, 6));
                    if (errorMessage) setErrorMessage(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                />

                <Button
                  variant="primary"
                  loading={loading}
                  onPress={handleVerifyOtp}
                  style={styles.formButton}
                >
                  Verify & continue
                </Button>

                {/* Resend Timer & Switch Email */}
                <View style={styles.otpFooter}>
                  {resendTimer > 0 ? (
                    <Text style={styles.resendCooldown}>
                      Resend code in {resendTimer}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={styles.resendAction}>Resend code</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      setEmailStep('input');
                      setOtpCode('');
                      setErrorMessage(null);
                    }}
                  >
                    <Text style={styles.changeEmailText}>Use different email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Consent Line (Terms & Privacy) ── */}
        <View style={styles.consentContainer}>
          <Text style={styles.consentText}>
            By continuing, you agree to our{' '}
            <Text style={styles.consentLink} onPress={() => openUrl(TERMS_URL)}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.consentLink} onPress={() => openUrl(PRIVACY_URL)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: Spacing[6],
  },
  markImage: {
    width: 68,
    height: 68,
    marginBottom: Spacing[3],
  },
  title: {
    ...Typography.title,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing[1],
  },
  subtitle: {
    ...Typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  referralPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.tint.cyan,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.3)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    alignSelf: 'center',
    gap: Spacing[2],
    marginBottom: Spacing[4],
  },
  referralText: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.text.primary,
  },
  referralCode: {
    fontFamily: FontFamily.display,
    color: Colors.accent.cyan,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint.danger,
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.4)',
    borderRadius: Radius.sm,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    gap: Spacing[2],
  },
  errorText: {
    ...Typography.label,
    color: Colors.semantic.danger,
    flex: 1,
  },
  benefitsCard: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
    marginBottom: Spacing[6],
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing[4],
  },
  benefitItem: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  benefitLabel: {
    ...Typography.label,
    fontSize: 13,
    color: Colors.text.primary,
  },
  buttonStack: {
    gap: Spacing.gap,
    marginBottom: Spacing[5],
  },
  appleButton: {
    height: 56,
    borderRadius: Radius.button,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButtonText: {
    fontFamily: FontFamily.label,
    fontSize: 16,
    fontWeight: '600',
    color: '#05070D',
  },
  googleButton: {
    height: 56,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontFamily: FontFamily.label,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  emailButton: {
    height: 56,
    borderRadius: Radius.button,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailButtonText: {
    fontFamily: FontFamily.label,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  otpCard: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
    marginBottom: Spacing[5],
  },
  otpHeader: {
    marginBottom: Spacing[4],
  },
  otpTitle: {
    ...Typography.heading,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  otpSubtitle: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  formGroup: {
    gap: Spacing[3],
  },
  inputLabel: {
    ...Typography.overline,
    color: Colors.text.tertiary,
  },
  textInput: {
    height: 52,
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing[4],
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.text.primary,
  },
  otpInput: {
    fontFamily: FontFamily.metric,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  formButton: {
    marginTop: Spacing[2],
  },
  backOption: {
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },
  backOptionText: {
    ...Typography.label,
    color: Colors.accent.cyan,
  },
  otpFooter: {
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  resendCooldown: {
    ...Typography.label,
    color: Colors.text.tertiary,
    fontVariant: ['tabular-nums'],
  },
  resendAction: {
    ...Typography.label,
    color: Colors.accent.cyan,
    fontWeight: '600',
  },
  changeEmailText: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  consentContainer: {
    paddingHorizontal: Spacing[2],
    alignItems: 'center',
  },
  consentText: {
    ...Typography.label,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  consentLink: {
    color: Colors.accent.cyan,
    textDecorationLine: 'underline',
  },
});
