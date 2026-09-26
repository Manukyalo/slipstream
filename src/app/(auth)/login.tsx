import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please fill in both email and password.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      const err =
        mode === 'signin'
          ? await signInWithEmail(email.trim(), password)
          : await signUpWithEmail(email.trim(), password);

      if (err) {
        setErrorMessage(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.brand}>
          <Text style={styles.title}>Slipstream</Text>
          <View style={styles.accentLine} />
          <Text style={styles.tagline}>High-Performance Telemetry & Navigation</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabToggle}>
            <Pressable
              style={[styles.toggleBtn, mode === 'signin' && styles.toggleBtnActive]}
              onPress={() => {
                setMode('signin');
                setErrorMessage(null);
              }}
            >
              <Text
                style={[styles.toggleBtnText, mode === 'signin' && styles.toggleBtnTextActive]}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleBtn, mode === 'signup' && styles.toggleBtnActive]}
              onPress={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
            >
              <Text
                style={[styles.toggleBtnText, mode === 'signup' && styles.toggleBtnTextActive]}
              >
                Sign Up
              </Text>
            </Pressable>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="driver@slipstream.io"
              placeholderTextColor={Colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor={Colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              loading && styles.btnDisabled,
              pressed && !loading && styles.btnPressed,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.bgBase} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'signin' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 40,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  accentLine: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.accentCyan,
    marginTop: 8,
    marginBottom: 8,
  },
  tagline: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 16,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.bgElevated,
    borderRadius: 8,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: Colors.bgSurface,
  },
  toggleBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.textMuted,
  },
  toggleBtnTextActive: {
    color: Colors.textPrimary,
  },
  errorBox: {
    backgroundColor: Colors.accentRedDim,
    borderColor: Colors.accentRed,
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.accentRed,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bgElevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
  },
  primaryBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: 8,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.bgBase,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
