import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

interface LocationConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function LocationConsentModal({
  visible,
  onAccept,
  onDecline,
}: LocationConsentModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🛰️</Text>
          </View>

          <Text style={styles.title}>Background Location Access</Text>

          <Text style={styles.body}>
            Slipstream collects location data in real-time to enable:{'\n\n'}
            • <Text style={styles.highlight}>Live GPS Telemetry</Text> — records speed curves, trip distance, and route maps.{'\n'}
            • <Text style={styles.highlight}>Radar & Speed Trap Alerts</Text> — alerts you to upcoming road hazards while driving.{'\n'}
            • <Text style={styles.highlight}>Background Recording</Text> — continues logging when your screen is locked or while using other apps.
          </Text>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyText}>
              🔒 Your raw per-second GPS points are purged after 30 days to protect your privacy. Location data is never sold or used for advertising.
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.declineBtn, pressed && styles.btnPressed]}
              onPress={onDecline}
            >
              <Text style={styles.declineText}>Not Now</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.btnPressed]}
              onPress={onAccept}
            >
              <Text style={styles.acceptText}>Agree & Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 11, 20, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentCyanDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  highlight: {
    fontFamily: FontFamily.semiBold,
    color: Colors.accentCyan,
  },
  privacyNote: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  privacyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  declineText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    color: Colors.textMuted,
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
  },
  acceptText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.bgBase,
  },
  btnPressed: {
    opacity: 0.8,
  },
});
