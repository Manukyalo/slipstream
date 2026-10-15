/**
 * StatCard — metric display card
 *
 * Icon chip + label + large value + optional unit.
 * Built on Card, so it inherits L1 surface + hairline border.
 *
 * Usage:
 *   <StatCard
 *     icon="gauge"
 *     iconColor="cyan"
 *     label="Top Speed"
 *     value="237"
 *     unit="km/h"
 *   />
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { Card } from './Card';
import { IconChip, type IconChipColor } from './IconChip';
import { Text } from './Text';
import type { IconName } from './Icon';

interface StatCardProps {
  icon: IconName;
  iconColor?: IconChipColor;
  label: string;
  value: string | number;
  unit?: string;
  /** Highlight the value in cyan (live data) */
  live?: boolean;
  style?: ViewStyle;
}

export function StatCard({
  icon,
  iconColor = 'cyan',
  label,
  value,
  unit,
  live = false,
  style,
}: StatCardProps) {
  return (
    <Card style={[styles.card, style]}>
      <View style={styles.header}>
        <IconChip name={icon} color={iconColor} />
      </View>

      <View style={styles.metricRow}>
        <Text
          variant="metricL"
          color={live ? Colors.accent.cyan : Colors.text.primary}
          tabular
        >
          {value}
        </Text>
        {unit && (
          <Text variant="label" color={Colors.text.tertiary} style={styles.unit}>
            {unit}
          </Text>
        )}
      </View>

      <Text variant="label" color={Colors.text.secondary}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing[2],
  },
  header: {
    marginBottom: Spacing[1],
  },
  metricRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           Spacing[1],
  },
  unit: {
    paddingBottom: 4, // Align baseline with the large number
  },
});
