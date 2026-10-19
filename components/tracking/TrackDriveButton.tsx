/**
 * TrackDriveButton — Primary Action, Pit Stop & Hold-to-Stop Controls
 *
 * States:
 *  - Idle: Gradient cyan→blue, height 56, haptic on press ("Start drive")
 *  - GPS Waiting: "Acquiring GPS lock (<30m)..." state while waiting for initial fix
 *  - Recording: Pit Stop button (amber pause) beside "Hold to stop" (red progress fill over 1.5s)
 *  - Pit-Stopped: "Continue drive" (gradient play) beside "Hold to stop"
 *  - Saving: "Saving trip telemetry..." with spinner
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
  isPitStopped?: boolean;
  isGpsWaiting?: boolean;
  isSaving?: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

const HOLD_DURATION_MS = 1500;

export function TrackDriveButton({
  isTracking,
  isPitStopped = false,
  isGpsWaiting = false,
  isSaving = false,
  onStart,
  onStop,
  onPause,
  onResume,
}: TrackDriveButtonProps) {
  const { gaugeTheme } = usePreferences();
  const gaugeThemeTokens = GaugeThemes[gaugeTheme];
  const [holding, setHolding] = useState(false);
  const [holdProgress] = useState(() => new Animated.Value(0));
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStartPress = async () => {
    if (isSaving || isGpsWaiting) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStart();
  };

  const handlePausePress = async () => {
    if (isSaving) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPause?.();
  };

  const handleResumePress = async () => {
    if (isSaving) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onResume?.();
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

  if (isGpsWaiting) {
    return (
      <View style={[styles.base, styles.gpsWaitBtn]}>
        <ActivityIndicator color={Colors.semantic.warning} size="small" />
        <Text style={styles.gpsWaitText}>Acquiring GPS fix (accuracy &lt; 30m)...</Text>
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
    <View style={styles.trackingRow}>
      {/* Pit Stop / Continue button */}
      {!isPitStopped ? (
        <TouchableOpacity
          onPress={handlePausePress}
          activeOpacity={0.8}
          style={styles.pitStopBtn}
        >
          <Icon name="pause" size={18} color={Colors.semantic.warning} weight="fill" />
          <Text style={styles.pitStopBtnLabel}>Pit stop</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={handleResumePress}
          activeOpacity={0.85}
          style={styles.continueBtn}
        >
          <LinearGradient
            colors={gaugeThemeTokens.ctaGradient as [string, string]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.contentRow}>
            <Icon name="play" size={18} color={Colors.bg.base} weight="fill" />
            <Text style={styles.continueBtnLabel}>Continue</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Hold-to-stop control */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.base, styles.stopBtnContainer]}
      >
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
            <Icon name="stop" size={15} color={Colors.semantic.danger} weight="fill" />
          </View>
          <Text style={styles.stopLabel} numberOfLines={1}>
            {holding ? 'Hold to finish...' : 'Hold to stop'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
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
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'stretch',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  startLabel: {
    fontFamily: FontFamily.display,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.bg.base,
    letterSpacing: 0.3,
  },
  pitStopBtn: {
    height: 56,
    paddingHorizontal: 16,
    borderRadius: Radius.button,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pitStopBtnLabel: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.semantic.warning,
    letterSpacing: 0.2,
  },
  continueBtn: {
    flex: 1.1,
    height: 56,
    borderRadius: Radius.button,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnLabel: {
    fontFamily: FontFamily.display,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bg.base,
    letterSpacing: 0.3,
  },
  stopBtnContainer: {
    flex: 1,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(244,63,94,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopLabel: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
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
  gpsWaitBtn: {
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    flexDirection: 'row',
    gap: 10,
  },
  gpsWaitText: {
    ...Typography.label,
    color: Colors.semantic.warning,
  },
});
