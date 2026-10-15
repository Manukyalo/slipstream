/**
 * BiometricLockScreen — Interstitial lock screen for biometric app lock
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { IconChip } from '@/components/ui/IconChip';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
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
        <IconChip name="lock" color="cyan" chipSize={72} size={36} />

        <View style={styles.textWrap}>
          <Text variant="heading" centered>
            Slipstream Locked
          </Text>
          <Text variant="body" color={Colors.text.secondary} centered style={styles.subtitle}>
            Biometric app lock is enabled. Authenticate using Face ID, Touch ID, or your device passcode.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button variant="primary" onPress={handleUnlock}>
            Unlock App
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.base,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.screen,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
    gap: Spacing[6],
  },
  textWrap: {
    alignItems: 'center',
    gap: Spacing[2],
  },
  subtitle: {
    lineHeight: 22,
  },
  actions: {
    width: '100%',
    marginTop: Spacing[2],
  },
});
