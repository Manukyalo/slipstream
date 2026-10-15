/**
 * MetricCard — Phase 8 Card Rhythm
 *
 * Hierarchy:
 *  - Tinted icon chip at top
 *  - 13 px muted label above
 *  - 32 px bold tabular value with 14 px muted unit beside it
 *  - Count-up animation on first view
 *  - Shows dash (—) when zero data / null
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { IconChip, type IconChipColor } from '@/components/ui/IconChip';
import { Text } from '@/components/ui/Text';
import type { IconName } from '@/components/ui/Icon';

interface MetricCardProps {
  icon: IconName;
  iconColor?: IconChipColor;
  label: string;
  numericValue: number | null;
  displayValue?: string;
  unit?: string;
  hasData?: boolean;
  style?: ViewStyle;
}

export function MetricCard({
  icon,
  iconColor = 'cyan',
  label,
  numericValue,
  displayValue,
  unit,
  hasData = true,
  style,
}: MetricCardProps) {
  const [animatedDisplay, setAnimatedDisplay] = useState<string>('0');

  useEffect(() => {
    if (!hasData || numericValue == null) {
      return;
    }

    if (displayValue && !Number.isFinite(numericValue)) {
      return;
    }

    // Smooth count-up animation over 600 ms
    let frame = 0;
    const totalFrames = 24;
    const intervalMs = 25;
    const target = numericValue;
    const isDecimal = !Number.isInteger(target);

    const timer = setInterval(() => {
      frame += 1;
      const progress = frame / totalFrames;
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;

      if (frame >= totalFrames) {
        clearInterval(timer);
        setAnimatedDisplay(
          displayValue ?? (isDecimal ? target.toFixed(1) : Math.round(target).toString())
        );
      } else {
        setAnimatedDisplay(
          isDecimal ? current.toFixed(1) : Math.round(current).toString()
        );
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [numericValue, displayValue, hasData]);

  const renderedValue =
    !hasData || numericValue == null
      ? '—'
      : displayValue && !Number.isFinite(numericValue)
      ? displayValue
      : animatedDisplay;

  return (
    <Card style={[styles.card, style]}>
      {/* Icon chip */}
      <View style={styles.iconWrap}>
        <IconChip name={icon} color={iconColor} chipSize={36} size={18} />
      </View>

      {/* 13 px muted label */}
      <Text variant="label" color={Colors.text.tertiary} style={styles.label}>
        {label}
      </Text>

      {/* 32 px tabular value with 14 px muted unit */}
      <View style={styles.valueRow}>
        <Text
          variant="heading"
          color={hasData && numericValue != null ? Colors.text.primary : Colors.text.tertiary}
          style={styles.valText}
          tabular
        >
          {renderedValue}
        </Text>
        {unit && hasData && numericValue != null && (
          <Text variant="label" color={Colors.text.tertiary} style={styles.unitText}>
            {unit}
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing[4],
    gap: Spacing[1],
    borderRadius: Radius.card,
  },
  iconWrap: {
    marginBottom: Spacing[2],
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  valText: {
    fontSize: 32,
    lineHeight: 36,
    fontFamily: FontFamily.numberBold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  unitText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FontFamily.body,
    paddingBottom: 2,
  },
});
