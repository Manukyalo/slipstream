/**
 * ShareRecapModal — Phase 8 Story Card
 *
 * Renders a scaled preview of the 1080×1920 StoryCardView offscreen,
 * captures it via react-native-view-shot, and shares via expo-sharing.
 * Zero emojis, zero "Pro Marketing Card" internal wording.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { StoryCardView, type StoryCardData } from '@/components/recap/StoryCardView';
import {
  captureAndShareStoryCard,
  buildStoryCardData,
  type GenerateRecapCardParams,
} from '@/services/shareCard';

interface ShareRecapModalProps {
  visible: boolean;
  params: GenerateRecapCardParams | null;
  userHandle?: string;
  country?: string;
  vehicleName?: string;
  referralCode?: string;
  onClose: () => void;
}

export function ShareRecapModal({
  visible,
  params,
  userHandle = 'pilot',
  country = 'Kenya',
  vehicleName = 'Slipstream Vehicle',
  referralCode,
  onClose,
}: ShareRecapModalProps) {
  const cardRef = useRef<View>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const storyData: StoryCardData | null = params
    ? buildStoryCardData(params, userHandle, vehicleName, country)
    : null;

  if (storyData && referralCode) {
    storyData.referralCode = referralCode;
  }

  const handleShare = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    // Short delay so the offscreen view has fully rendered before capture
    await new Promise<void>((r) => setTimeout(r, 150));

    const result = await captureAndShareStoryCard(cardRef);
    setLoading(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMsg(result.error ?? 'Failed to capture telemetry card. Please try again.');
    }
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setErrorMsg(null);
    handleShare();
  }, [handleShare]);

  if (!params || !storyData) return null;

  const isDrag = params.type === 'drag' || params.type === 'sprint';
  const heroStat = isDrag
    ? `${((params.elapsedMs ?? 0) / 1000).toFixed(2)}s`
    : `${Math.round(params.topSpeedKmh ?? 0)} km/h`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text variant="heading" color={Colors.text.primary}>
                Share Story Card
              </Text>
              <Text variant="label" color={Colors.text.tertiary} style={styles.headerSub}>
                {isDrag ? 'Sprint benchmark' : 'Telemetry run'} · {heroStat}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Icon name="close" size={22} color={Colors.text.secondary} />
            </Pressable>
          </View>

          {/* Scaled card preview */}
          <ScrollView
            horizontal={false}
            contentContainerStyle={styles.previewScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Scale transform: full 1080×1920 rendered at display size */}
            <View style={styles.previewOuter}>
              <View style={styles.previewTransformBox}>
                <StoryCardView ref={cardRef} data={storyData} />
              </View>
            </View>
          </ScrollView>

          {/* Error state */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Icon name="warning" size={16} color={Colors.semantic.warning} />
              <View style={styles.errorTextWrap}>
                <Text variant="label" color={Colors.text.secondary} style={styles.errorText}>
                  {errorMsg}
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.shareBtn,
                loading && styles.btnDisabled,
                pressed && !loading && styles.btnPressed,
              ]}
              onPress={errorMsg ? handleRetry : handleShare}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.bg.base} size="small" />
                  <Text variant="label" color={Colors.text.inverse} style={styles.shareBtnText}>
                    Capturing…
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <Icon name="share" size={18} color={Colors.bg.base} />
                  <Text variant="label" color={Colors.text.inverse} style={styles.shareBtnText}>
                    {errorMsg ? 'Retry Share' : 'Share to Instagram / WhatsApp'}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
              onPress={onClose}
              disabled={loading}
            >
              <Text variant="label" color={Colors.text.tertiary}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CARD_SCALE = 0.29; // Scale factor: 1080 * 0.29 ≈ 313 px display width

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface['1'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.screen,
    gap: Spacing.gap,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: Spacing.gap,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  headerSub: {
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing[2],
    marginTop: -4,
  },
  previewScroll: {
    alignItems: 'center',
    paddingVertical: Spacing[2],
  },
  // We render StoryCardView at its natural 1080×1920 and scale the outer wrapper
  previewOuter: {
    width: 1080 * CARD_SCALE,
    height: 1920 * CARD_SCALE,
    borderRadius: Radius.card * 1.5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  previewTransformBox: {
    width: 1080,
    height: 1920,
    transform: [{ scale: CARD_SCALE }],
    transformOrigin: 'top left',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.gap,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: Radius.iconChip,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  errorTextWrap: {
    flex: 1,
  },
  errorText: {
    lineHeight: 18,
  },
  actions: {
    gap: Spacing[2],
    paddingTop: Spacing[2],
  },
  shareBtn: {
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 16,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  shareBtnText: {
    ...Typography.label,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPressed: {
    opacity: 0.85,
  },
});
