import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { authenticateWithBiometrics } from '@/services/biometrics';

interface BiometricLockScreenProps {
  onUnlock: () => void;
}

export function BiometricLockScreen({ onUnlock }: BiometricLockScreenProps) {
  const handleUnlock = async () => {
    const success = await authenticateWithBiometrics('Unlock Slipstream');
    if (success) {
      onUnlock();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>

        <Text style={styles.title}>Slipstream Locked</Text>
        <Text style={styles.subtitle}>
          Biometric app-lock is enabled. Authenticate using Face ID, Touch ID, or your device passcode.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.unlockBtn, pressed && styles.btnPressed]}
          onPress={handleUnlock}
        >
          <Text style={styles.unlockBtnText}>Unlock App</Text>
        </Pressable>
      </View>
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
  content: {
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(235, 94, 40, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(235, 94, 40, 0.3)',
    marginBottom: Spacing.xl,
  },
  lockIcon: {
    fontSize: 32,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['2xl'],
  },
  unlockBtn: {
    backgroundColor: Colors.accentOrange,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.85,
  },
  unlockBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.bgBase,
    letterSpacing: 0.5,
  },
});
