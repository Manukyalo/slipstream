import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/design';
import type { DragRaceStatus } from '@/hooks/useDragRace';

interface ChristmasTreeProps {
  status: DragRaceStatus;
}

export function ChristmasTree({ status }: ChristmasTreeProps) {
  const isPreStaged = status === 'staging' || status === 'staged' || status === 'running';
  const isStaged = status === 'staged' || status === 'running';
  const isGreen = status === 'running';

  return (
    <View style={styles.treeContainer}>
      {/* Top Pre-Stage & Stage Light Bar */}
      <View style={styles.stageRow}>
        <View style={styles.bulbWrapper}>
          <View style={[styles.bulb, styles.bulbAmber, isPreStaged && styles.bulbAmberLit]} />
          <Text style={styles.bulbLabel}>PRE-STAGE</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.bulbWrapper}>
          <View style={[styles.bulb, styles.bulbAmber, isStaged && styles.bulbAmberLit]} />
          <Text style={styles.bulbLabel}>STAGED</Text>
        </View>
      </View>

      {/* Main Signal Lights */}
      <View style={styles.lightsColumn}>
        {/* Countdown amber 1, 2, 3 */}
        <View style={styles.lightRow}>
          <View style={[styles.bulb, styles.bulbAmber, isStaged && styles.bulbAmberLit]} />
          <View style={[styles.bulb, styles.bulbAmber, isStaged && styles.bulbAmberLit]} />
        </View>

        {/* Green Launch */}
        <View style={styles.lightRow}>
          <View style={[styles.bulb, styles.bulbGreen, isGreen && styles.bulbGreenLit]} />
          <View style={[styles.bulb, styles.bulbGreen, isGreen && styles.bulbGreenLit]} />
        </View>
      </View>

      {/* Status banner */}
      <View style={styles.statusWrap}>
        <Text style={[styles.statusText, isGreen ? styles.statusGreen : isStaged ? styles.statusAmber : styles.statusMuted]}>
          {status === 'idle'
            ? 'PRESS STAGE WHEN READY'
            : status === 'staging'
            ? 'CALIBRATING SENSORS...'
            : status === 'staged'
            ? 'READY — ACCELERATE HARD'
            : status === 'running'
            ? 'FULL THROTTLE'
            : 'RUN COMPLETE'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  treeContainer: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  bulbWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  bulbLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 8,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  lightsColumn: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  lightRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bulb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
  },
  bulbAmber: {
    backgroundColor: '#3A2800',
    borderColor: '#5C4000',
  },
  bulbAmberLit: {
    backgroundColor: '#FFB800',
    borderColor: '#FFE082',
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
  },
  bulbGreen: {
    backgroundColor: '#0A3319',
    borderColor: '#13592D',
  },
  bulbGreenLit: {
    backgroundColor: '#00FF66',
    borderColor: '#B3FFD6',
    shadowColor: '#00FF66',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  statusWrap: {
    marginTop: 2,
  },
  statusText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusMuted: {
    color: Colors.textMuted,
  },
  statusAmber: {
    color: '#FFB800',
  },
  statusGreen: {
    color: '#00FF66',
  },
});
