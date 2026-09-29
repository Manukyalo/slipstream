import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import {
  generateAndShareRecapCard,
  type GenerateRecapCardParams,
} from '@/services/shareCard';

interface ShareRecapModalProps {
  visible: boolean;
  params: GenerateRecapCardParams | null;
  onClose: () => void;
}

export function ShareRecapModal({ visible, params, onClose }: ShareRecapModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!params) return null;

  const handleShare = async () => {
    setLoading(true);
    setErrorMsg(null);

    const result = await generateAndShareRecapCard(params);
    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMsg(result.error ?? 'Failed to generate recap card');
      Alert.alert(
        'Card Generation Failed',
        result.error ?? 'Could not generate story card. Please check your connection and retry.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handleShare },
        ],
      );
    }
  };

  const isDrag = params.type === 'drag' || params.type === 'sprint';
  const heroStat = isDrag
    ? `${((params.elapsedMs ?? 0) / 1000).toFixed(2)}s`
    : `${Math.round(params.topSpeedKmh ?? 0)} km/h`;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>SHARE STORY RECAP</Text>
              <Text style={styles.modalSubtitle}>1080×1920 Pro Marketing Card</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Story Card Mockup Preview */}
          <View style={styles.previewFrame}>
            <View style={styles.previewInner}>
              <View style={styles.previewTopBar}>
                <Text style={styles.previewBrand}>SLIPSTREAM</Text>
                <Text style={styles.previewBadge}>PRO RUN</Text>
              </View>

              <Text style={styles.previewHeadline} numberOfLines={1}>
                {params.headline ?? (isDrag ? 'SPRINT BENCHMARK' : 'HIGH-SPEED RUN')}
              </Text>
              <Text style={styles.previewVehicle} numberOfLines={1}>
                🏎️ {params.vehicleName ?? 'PILOT BENCHMARK'}
              </Text>

              {/* Center Hero Stat */}
              <View style={styles.heroBox}>
                <Text style={styles.heroStatValue}>{heroStat}</Text>
                <Text style={styles.heroStatLabel}>
                  {isDrag ? 'ELAPSED BENCHMARK' : 'PEAK RECORDED VELOCITY'}
                </Text>
              </View>

              {/* Bottom Card Bar with QR representation */}
              <View style={styles.previewBottomBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewInviteText}>JOIN THE CREW</Text>
                  <Text style={styles.previewSubText}>Scan to compare telemetry</Text>
                </View>
                <View style={styles.qrStub}>
                  <Text style={{ fontSize: 14 }}>📱</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Error Message if any */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                loading && styles.btnDisabled,
                pressed && styles.btnPressed,
              ]}
              onPress={handleShare}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.bgBase} size="small" />
                  <Text style={styles.shareBtnText}>GENERATING SERVER CARD...</Text>
                </View>
              ) : (
                <Text style={styles.shareBtnText}>SHARE TO INSTAGRAM / WHATSAPP</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 6, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.base,
  },
  cardContainer: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    maxWidth: 400,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  modalSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    padding: Spacing.xs,
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 9 / 14,
    backgroundColor: '#080B14',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.base,
    padding: Spacing.md,
  },
  previewInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewBrand: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    color: Colors.accentCyan,
    letterSpacing: 2,
  },
  previewBadge: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.accentCyan,
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 1,
  },
  previewHeadline: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    letterSpacing: 0.5,
  },
  previewVehicle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  heroBox: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: 'center',
  },
  heroStatValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.display,
    color: Colors.accentCyan,
    letterSpacing: 1,
  },
  heroStatLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: 4,
  },
  previewBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24, 30, 46, 0.8)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  previewInviteText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  previewSubText: {
    fontFamily: FontFamily.regular,
    fontSize: 8,
    color: Colors.textSecondary,
  },
  qrStub: {
    width: 32,
    height: 32,
    backgroundColor: Colors.bgBase,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentRed,
  },
  actions: {
    gap: Spacing.xs,
  },
  shareBtn: {
    backgroundColor: Colors.accentCyan,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shareBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.bgBase,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
