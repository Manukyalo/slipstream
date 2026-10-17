/**
 * TrackDriveButton — Primary Action & Hold-to-Stop Control
 *
 * Requirements:
 *  - Idle: Gradient cyan→blue, height 56, haptic on press ("Start drive")
 *  - Recording: Becomes "Hold to stop" with a red progress ring/bar filling over 1.5s
 *  - Haptics on press-in and hold completion
 */

import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, GaugeThemes, Radius, Typography } from '@/constants/theme';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Icon } from '@/components/ui/Icon';

interface TrackDriveButtonProps {
  isTracking: boolean;
  isSaving?: boolean;
  onStart: () => void;
  onStop: () => void;
}

const HOLD_DURATION_MS = 1500;

export function TrackDriveButton({
  isTracking,
  isSaving = false,
  onStart,
  onStop,
}: TrackDriveButtonProps) {
  const { gaugeTheme } = usePreferences();
  const gaugeThemeTokens = GaugeThemes[gaugeTheme];
  const [holding, setHolding] = useState(false);
  const [holdProgress] = useState(() => new Animated.Value(0));
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStartPress = async () => {
    if (isSaving) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const handlePressIn = () => {
    if (!isTracking || isSaving) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    holdProgress.setValue(0);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: false,
    }).start();

    holdTimeout.current = setTimeout(async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHolding(false);
      holdProgress.setValue(0);
      onStop();
    }, HOLD_DURATION_MS);
  };

  const handlePressOut = () => {
    if (!isTracking || isSaving) return;
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    setHolding(false);
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  // Active recording: Hold to stop progress animation
  const progressWidth = useMemo(
    () =>
      holdProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
      }),
    [holdProgress],
  );

  if (isSaving) {
    return (
      <View style={[styles.base, styles.savingBtn]}>
        <ActivityIndicator color={Colors.accent.cyan} size="small" />
        <Text style={styles.savingText}>Saving trip telemetry...</Text>
      </View>
    );
  }

  if (!isTracking) {
    return (
      <TouchableOpacity
        onPress={handleStartPress}
        activeOpacity={0.85}
        style={styles.base}
      >
        <LinearGradient
          colors={gaugeThemeTokens.ctaGradient as [string, string]}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.contentRow}>
          <Icon name="play" size={20} color={Colors.bg.base} weight="fill" />
          <Text style={styles.startLabel}>Start drive</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.base, styles.stopBtnContainer]}
    >
      {/* Animated red progress fill */}
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: progressWidth,
            backgroundColor: holding ? 'rgba(244,63,94,0.35)' : 'transparent',
          },
        ]}
      />

      <View style={styles.contentRow}>
        <View style={styles.stopIconBox}>
          <Icon name="stop" size={16} color={Colors.semantic.danger} weight="fill" />
        </View>
        <Text style={styles.stopLabel}>
          {holding ? 'Hold to finish drive...' : 'Hold to finish drive'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: Radius.button,
    overflow: 'hidden',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2,
  },
  startLabel: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.bg.base,
    letterSpacing: 0.3,
  },
  stopBtnContainer: {
    backgroundColor: Colors.surface['2'],
    borderWidth: 1.5,
    borderColor: 'rgba(244,63,94,0.4)',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  stopIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244,63,94,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopLabel: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    color: Colors.text.primary,
    letterSpacing: 0.2,
  },
  savingBtn: {
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    flexDirection: 'row',
    gap: 10,
  },
  savingText: {
    ...Typography.label,
    color: Colors.accent.cyan,
  },
});
