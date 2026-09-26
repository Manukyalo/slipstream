import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { DRAG_DISTANCE_LABELS, type DragDistanceType } from '@/services/dragRuns';
import type { SplitResult } from '@/hooks/useDragRace';

interface SplitTimeCardProps {
  distanceType: DragDistanceType;
  split: SplitResult | null;
  targetMeters: number;
}

export function SplitTimeCard({ distanceType, split, targetMeters }: SplitTimeCardProps) {
  const isCompleted = split !== null;
  const elapsedSecs = isCompleted ? (split.elapsedMs / 1000).toFixed(2) : '--.--';
  const trapSpeed = isCompleted ? split.trapSpeedKmh.toFixed(1) : '---';

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{DRAG_DISTANCE_LABELS[distanceType]}</Text>
          <Text style={styles.targetDist}>{targetMeters} METERS</Text>
        </View>

        {isCompleted && (
          <View style={styles.savedChip}>
            <Text style={styles.savedText}>SAVED ✓</Text>
          </View>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <Text style={[styles.metricValue, isCompleted && styles.metricCompleted]}>
            {elapsedSecs}
            <Text style={styles.unit}>s</Text>
          </Text>
          <Text style={styles.metricLabel}>ELAPSED TIME</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricBlock}>
          <Text style={[styles.metricValue, isCompleted && styles.metricCompleted]}>
            {trapSpeed}
            <Text style={styles.unit}>km/h</Text>
          </Text>
          <Text style={styles.metricLabel}>TRAP SPEED</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  cardCompleted: {
    borderColor: Colors.accentCyan,
    backgroundColor: Colors.bgElevated,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  targetDist: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  savedChip: {
    backgroundColor: Colors.accentCyanDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  savedText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.accentCyan,
    letterSpacing: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricBlock: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: Spacing.base,
  },
  metricValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textSecondary,
    letterSpacing: -0.5,
  },
  metricCompleted: {
    color: Colors.textPrimary,
  },
  unit: {
    fontSize: FontSize.label,
    fontFamily: FontFamily.medium,
    color: Colors.accentCyan,
    marginLeft: 2,
  },
  metricLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
});
