/**
 * DrivingStyleCard — Phase 8 Driving Dynamics
 *
 * Section presenting:
 *  - Two-colour turn-preference bar (Cyan for Left vs Blue for Right)
 *  - Metric pills for left & right turns, brake events, and lane changes
 *  - High-G dynamics: max acceleration (+G), max deceleration (-G), and peak lateral G
 *  - Graceful zero-data handling with dashes (—) and placeholder balance
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { IconChip } from '@/components/ui/IconChip';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import type { DrivingStyleStats } from '@/services/profileStats';

interface DrivingStyleCardProps {
  stats: DrivingStyleStats;
  hasData?: boolean;
  style?: ViewStyle;
}

export function DrivingStyleCard({ stats, hasData = true, style }: DrivingStyleCardProps) {
  const leftPct = hasData ? stats.leftTurnPercent : 50;
  const rightPct = hasData ? stats.rightTurnPercent : 50;

  return (
    <Card style={[styles.card, style]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <IconChip name="path" color="cyan" chipSize={36} size={18} />
          <View style={styles.headerTitles}>
            <Text variant="label" color={Colors.text.primary} style={styles.title}>
              DRIVING STYLE
            </Text>
            <Text variant="overline" color={Colors.text.tertiary} style={styles.subtitle}>
              Turn bias & dynamics
            </Text>
          </View>
        </View>
        {hasData && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text variant="overline" color={Colors.accent.cyan} style={styles.liveBadgeText}>
              CALIBRATED
            </Text>
          </View>
        )}
      </View>

      {/* Turn Preference Bar */}
      <View style={styles.turnSection}>
        <View style={styles.turnLabelsRow}>
          <View style={styles.turnLabelGroup}>
            <Icon name="arrow-left" size={14} color={Colors.accent.cyan} />
            <Text variant="label" color={Colors.accent.cyan} style={styles.turnPctText} tabular>
              {hasData ? `${leftPct}%` : '—'}
            </Text>
            <Text variant="overline" color={Colors.text.tertiary}>
              LEFT {hasData && `(${stats.leftTurns})`}
            </Text>
          </View>

          <View style={[styles.turnLabelGroup, styles.turnLabelRight]}>
            <Text variant="overline" color={Colors.text.tertiary}>
              RIGHT {hasData && `(${stats.rightTurns})`}
            </Text>
            <Text variant="label" color={Colors.accent.blue} style={styles.turnPctText} tabular>
              {hasData ? `${rightPct}%` : '—'}
            </Text>
            <Icon name="arrow-right" size={14} color={Colors.accent.blue} />
          </View>
        </View>

        {/* Stacked bar */}
        <View style={styles.turnBarTrack}>
          <View
            style={[
              styles.turnBarLeft,
              { flex: Math.max(0.05, leftPct) },
              !hasData && styles.barMuted,
            ]}
          />
          <View style={styles.turnBarDivider} />
          <View
            style={[
              styles.turnBarRight,
              { flex: Math.max(0.05, rightPct) },
              !hasData && styles.barMuted,
            ]}
          />
        </View>
      </View>

      {/* Maneuver Counters: Brake Events & Lane Changes (Stacked Layout) */}
      <View style={styles.pillsRow}>
        {/* Brake Events Card */}
        <View style={styles.pillBox}>
          <View style={styles.pillIconWrap}>
            <Icon name="warning" size={16} color={Colors.semantic.warning} />
          </View>
          <Text
            variant="overline"
            color={Colors.text.tertiary}
            style={styles.pillLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            BRAKE EVENTS
          </Text>
          <View style={styles.pillValueRow}>
            <Text variant="heading" color={Colors.text.primary} style={styles.pillValue} tabular>
              {hasData ? stats.brakeEvents : '—'}
            </Text>
            {hasData && (
              <Text variant="label" color={Colors.text.tertiary} style={styles.pillUnit}>
                events
              </Text>
            )}
          </View>
        </View>

        {/* Lane Changes Card */}
        <View style={styles.pillBox}>
          <View style={styles.pillIconWrap}>
            <Icon name="car" size={16} color={Colors.accent.cyan} />
          </View>
          <Text
            variant="overline"
            color={Colors.text.tertiary}
            style={styles.pillLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            LANE CHANGES
          </Text>
          <View style={styles.pillValueRow}>
            <Text variant="heading" color={Colors.text.primary} style={styles.pillValue} tabular>
              {hasData ? stats.laneChanges : '—'}
            </Text>
            {hasData && (
              <Text variant="label" color={Colors.text.tertiary} style={styles.pillUnit}>
                switches
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Dynamics Row: Max Accel, Decel, Lateral G (Equal-width columns, aligned baseline) */}
      <View style={styles.dynamicsRow}>
        <View style={styles.dynamicItem}>
          <Text variant="overline" color={Colors.text.tertiary} style={styles.dynamicLabel} numberOfLines={1}>
            MAX ACCEL
          </Text>
          <Text
            variant="heading"
            color={hasData ? Colors.semantic.success : Colors.text.tertiary}
            style={styles.dynamicValue}
            tabular
          >
            {hasData ? `+${stats.maxAccelG.toFixed(2)}` : '—'}
          </Text>
          <Text variant="overline" color={Colors.text.tertiary} style={styles.dynamicUnit}>
            G-FORCE
          </Text>
        </View>

        <View style={styles.dynamicDivider} />

        <View style={styles.dynamicItem}>
          <Text variant="overline" color={Colors.text.tertiary} style={styles.dynamicLabel} numberOfLines={1}>
            MAX DECEL
          </Text>
          <Text
            variant="heading"
            color={hasData ? Colors.semantic.danger : Colors.text.tertiary}
            style={styles.dynamicValue}
            tabular
          >
            {hasData ? `-${stats.maxDecelG.toFixed(2)}` : '—'}
          </Text>
          <Text variant="overline" color={Colors.text.tertiary} style={styles.dynamicUnit}>
            G-FORCE
          </Text>
        </View>

        <View style={styles.dynamicDivider} />

        <View style={styles.dynamicItem}>
          <Text variant="overline" color={Colors.text.tertiary} style={styles.dynamicLabel} numberOfLines={1}>
            LATERAL
          </Text>
          <Text
            variant="heading"
            color={hasData ? Colors.accent.cyan : Colors.text.tertiary}
            style={styles.dynamicValue}
            tabular
          >
            {hasData ? `${stats.peakG.toFixed(2)}` : '—'}
          </Text>
          <Text variant="overline" color={Colors.text.tertiary} style={styles.dynamicUnit}>
            G-FORCE
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.card,
    borderRadius: Radius.card,
    gap: Spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    flexShrink: 1,
  },
  headerTitles: {
    flexShrink: 1,
  },
  title: {
    fontFamily: FontFamily.spaceGroteskBold,
    letterSpacing: 0.8,
  },
  subtitle: {
    letterSpacing: 0.5,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.accent.cyanGlow,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    alignSelf: 'center',
  },
  liveBadgeText: {
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.cyan,
  },
  turnSection: {
    gap: Spacing[2],
  },
  turnLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  turnLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  turnLabelRight: {
    flexDirection: 'row-reverse',
  },
  turnPctText: {
    fontFamily: FontFamily.numberBold,
    fontSize: 16,
  },
  turnBarTrack: {
    flexDirection: 'row',
    height: 10,
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  turnBarLeft: {
    backgroundColor: Colors.accent.cyan,
    borderTopLeftRadius: Radius.pill,
    borderBottomLeftRadius: Radius.pill,
  },
  turnBarDivider: {
    width: 2,
    backgroundColor: Colors.surface['0'],
  },
  turnBarRight: {
    backgroundColor: Colors.accent.blue,
    borderTopRightRadius: Radius.pill,
    borderBottomRightRadius: Radius.pill,
  },
  barMuted: {
    backgroundColor: Colors.surface['3'],
  },
  pillsRow: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  pillBox: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface['1'],
    padding: Spacing[3],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    gap: Spacing[1],
  },
  pillIconWrap: {
    width: 32,
    height: 32,
    borderRadius: Radius.iconChip,
    backgroundColor: Colors.surface['2'],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  pillLabel: {
    letterSpacing: 0.3,
    width: '100%',
  },
  pillValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  pillValue: {
    fontSize: 22,
    lineHeight: 26,
    fontFamily: FontFamily.numberBold,
  },
  pillUnit: {
    fontSize: 12,
  },
  dynamicsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface['1'],
    padding: Spacing[3],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
  },
  dynamicItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dynamicLabel: {
    letterSpacing: 0.4,
    fontSize: 9.5,
  },
  dynamicDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.hairline,
  },
  dynamicValue: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: FontFamily.numberBold,
    marginTop: 2,
  },
  dynamicUnit: {
    fontSize: 9,
    letterSpacing: 1,
  },
});
