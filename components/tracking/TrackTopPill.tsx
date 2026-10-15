/**
 * TrackTopPill — Floating Glass Quality & Hazard Strip
 *
 * Specifications (Phase 3):
 *  - Floating glass pill below status bar
 *  - GPS quality dot (Acquiring, Good, Weak) derived from GPS accuracy
 *  - Offline map status indicator & downloader trigger
 *  - "Report hazard" action in amber opening hazard sheet
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';

interface TrackTopPillProps {
  gpsAccuracy: number | null;
  downloadState?: string;
  downloadPercentage?: number;
  onOfflineMapPress: () => void;
  onReportHazardPress: () => void;
}

export function TrackTopPill({
  gpsAccuracy,
  downloadState,
  downloadPercentage,
  onOfflineMapPress,
  onReportHazardPress,
}: TrackTopPillProps) {
  // Pulse animation for Acquiring GPS state
  const [pulseAnim] = useState(() => new Animated.Value(1));

  const isAcquiring = gpsAccuracy === null || gpsAccuracy > 25;
  const isGood = gpsAccuracy !== null && gpsAccuracy <= 10;
  const isWeak = gpsAccuracy !== null && gpsAccuracy > 10 && gpsAccuracy <= 25;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isAcquiring) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [isAcquiring, pulseAnim]);

  // Dot color & text
  const qualityColor = isGood
    ? Colors.semantic.success
    : isWeak
    ? Colors.semantic.warning
    : Colors.semantic.warning;

  const qualityText = isGood ? 'GPS Good' : isWeak ? 'GPS Weak' : 'Acquiring';

  return (
    <View style={styles.glassContainer}>
      {/* ── 1. GPS Quality Indicator ── */}
      <View style={styles.section}>
        <Animated.View
          style={[
            styles.dot,
            { backgroundColor: qualityColor, opacity: isAcquiring ? pulseAnim : 1 },
          ]}
        />
        <Text style={styles.qualityLabel}>{qualityText}</Text>
      </View>

      <View style={styles.divider} />

      {/* ── 2. Offline Map Status ── */}
      <TouchableOpacity
        style={styles.section}
        onPress={onOfflineMapPress}
        activeOpacity={0.7}
      >
        <Icon name="map-pin" size={14} color={Colors.text.secondary} />
        <Text style={styles.offlineLabel}>
          {downloadState === 'downloading'
            ? `${downloadPercentage ?? 0}%`
            : downloadState === 'downloaded'
            ? 'Cached'
            : 'Offline map'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* ── 3. Report Hazard Button ── */}
      <TouchableOpacity
        style={styles.hazardBtn}
        onPress={onReportHazardPress}
        activeOpacity={0.8}
      >
        <Icon name="warning" size={14} color={Colors.semantic.warning} weight="bold" />
        <Text style={styles.hazardText}>Report hazard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 19, 27, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[3],
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    alignSelf: 'center',
    gap: Spacing[2],
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qualityLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.text.primary,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  offlineLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  hazardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing[3],
    paddingVertical: 5,
  },
  hazardText: {
    fontFamily: FontFamily.label,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.semantic.warning,
  },
});
