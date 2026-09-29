import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { SPRINT_LABELS, type SprintType } from '@/services/dragRuns';
import type { SprintResult } from '@/hooks/useDragRace';

interface SprintTimeCardProps {
  sprintType: SprintType;
  sprint: SprintResult | null;
}

export function SprintTimeCard({ sprintType, sprint }: SprintTimeCardProps) {
  const isCompleted = sprint !== null;
  const elapsedSecs = isCompleted ? (sprint.elapsedMs / 1000).toFixed(2) : '--.--';
  const trapSpeed = isCompleted ? sprint.trapSpeedKmh.toFixed(1) : '---';
  const subtitle = sprintType === 'zero_to_60' ? 'TARGET: 60 MPH (96.6 KM/H)' : 'TARGET: 100.0 KM/H';

  return (
    <View style={[styles.card, isCompleted && styles.cardCompleted]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{SPRINT_LABELS[sprintType]}</Text>
          <Text style={styles.targetSpeed}>{subtitle}</Text>
        </View>

        {isCompleted && (
          <View style={styles.savedChip}>
            <Text style={styles.savedText}>RECORDED ✓</Text>
          </View>
        )}
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <Text style={[styles.metricValue, isCompleted && styles.metricCompleted]}>
            {elapsedSecs}
            <Text style={styles.unit}>s</Text>
          </Text>
          <Text style={styles.metricLabel}>0–SPEED TIME</Text>
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
    borderColor: Colors.accentOrange,
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
  targetSpeed: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.4,
  },
  savedChip: {
    backgroundColor: Colors.accentOrangeDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.accentOrange,
  },
  savedText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.accentOrange,
    letterSpacing: 0.5,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricBlock: {
    flex: 1,
  },
  metricValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  metricCompleted: {
    color: Colors.accentOrange,
  },
  unit: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  metricLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.base,
  },
});
