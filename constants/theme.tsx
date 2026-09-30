/**
 * Slipstream Design System Foundation (theme.ts)
 *
 * Grounded in motorsport telemetry / pit-wall data panel aesthetics.
 * Never generic dashboard styling; disciplined, high-legibility dark theme.
 */

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

export const Theme = {
  colors: {
    bgVoid: '#0B0E11',           // Graphite void, never pure black
    surface: '#151A20',          // Pit-wall surface
    surfaceRaised: '#1D242C',    // Elevated telemetry pane
    surfaceBorder: '#232C36',    // 1px hairline border
    hairline: '#1D242C',         // Divider lines

    // Intent-driven functional accents
    signalCyan: '#34E5F0',       // Live-data ONLY (current speed, ready states, active telemetry)
    ignitionAmber: '#FF7A1A',    // Performance/drag ONLY (elapsed times, launch, g-force, stage)
    flagRed: '#FF3B4E',          // Hazard / warning / radar alert ONLY

    // Typography contrast
    textPrimary: '#EDEFF3',      // Primary readout
    textSecondary: '#A2ACB9',    // Secondary labels
    textMuted: '#7B8493',        // Captions, units, inactive states
    textInverse: '#0B0E11',      // On top of signal/amber fills
  },

  fonts: {
    // Space Grotesk for numbers, data readouts, and headlines (tabular figures)
    numberRegular: 'SpaceGrotesk_400Regular',
    numberMedium: 'SpaceGrotesk_500Medium',
    numberSemiBold: 'SpaceGrotesk_600SemiBold',
    numberBold: 'SpaceGrotesk_700Bold',

    // Inter for UI chrome, body, labels, metadata
    bodyRegular: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    bodyBold: 'Inter_700Bold',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 48,
    '4xl': 64,
  },

  radius: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 9999,
  },
} as const;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

interface HeroStatProps {
  value: string | number;
  unit?: string;
  label?: string;
  accentColor?: string;
  size?: 'hero' | 'large' | 'medium';
  align?: 'left' | 'center' | 'right';
  style?: ViewStyle;
  valueStyle?: TextStyle;
}

/**
 * HeroStat Primitive:
 * No card chrome, no border, no shadow — just type on the void.
 * Reserved for the single primary number readout on each screen.
 */
export function HeroStat({
  value,
  unit,
  label,
  accentColor = Theme.colors.textPrimary,
  size = 'hero',
  align = 'center',
  style,
  valueStyle,
}: HeroStatProps) {
  const isHero = size === 'hero';
  const isLarge = size === 'large';

  return (
    <View style={[styles.heroStatContainer, align === 'left' && styles.alignLeft, align === 'right' && styles.alignRight, style]}>
      {label && <Text style={styles.heroStatLabel}>{label}</Text>}
      <View style={styles.valueUnitRow}>
        <Text
          style={[
            styles.heroStatValue,
            isHero ? styles.valHero : isLarge ? styles.valLarge : styles.valMedium,
            { color: accentColor },
            valueStyle,
          ]}
        >
          {value}
        </Text>
        {unit && (
          <Text style={[styles.heroStatUnit, isHero ? styles.unitHero : styles.unitMedium]}>
            {unit}
          </Text>
        )}
      </View>
    </View>
  );
}

interface StatRowProps {
  icon?: LucideIcon;
  iconColor?: string;
  label: string;
  value: string | number;
  unit?: string;
  isLast?: boolean;
  valueColor?: string;
  subValue?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

/**
 * StatRow Primitive:
 * Icon + label + value with a 1px hairline divider below.
 * Flat telemetry list without individually shadowed cards.
 */
export function StatRow({
  icon: Icon,
  iconColor = Theme.colors.textMuted,
  label,
  value,
  unit,
  isLast = false,
  valueColor = Theme.colors.textPrimary,
  subValue,
  style,
}: StatRowProps) {
  return (
    <View style={[styles.statRow, !isLast && styles.hairlineDivider, style]}>
      <View style={styles.statRowLeft}>
        {Icon && (
          <View style={styles.statRowIconWrapper}>
            <Icon size={16} strokeWidth={1.5} color={iconColor} />
          </View>
        )}
        <Text style={styles.statRowLabel}>{label}</Text>
      </View>

      <View style={styles.statRowRight}>
        <View style={styles.valueRow}>
          <Text style={[styles.statRowValue, { color: valueColor }]}>{value}</Text>
          {unit && <Text style={styles.statRowUnit}>{unit}</Text>}
        </View>
        {subValue && <Text style={styles.statRowSubValue}>{subValue}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // HeroStat
  heroStatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  heroStatLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  valueUnitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  heroStatValue: {
    fontFamily: Theme.fonts.numberBold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  valHero: {
    fontSize: 64,
    lineHeight: 70,
  },
  valLarge: {
    fontSize: 40,
    lineHeight: 46,
  },
  valMedium: {
    fontSize: 24,
    lineHeight: 30,
  },
  heroStatUnit: {
    fontFamily: Theme.fonts.bodyMedium,
    color: Theme.colors.textMuted,
  },
  unitHero: {
    fontSize: 16,
    marginLeft: 4,
  },
  unitMedium: {
    fontSize: 12,
    marginLeft: 2,
  },

  // StatRow
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  hairlineDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.hairline,
  },
  statRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statRowIconWrapper: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRowLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 14,
    color: Theme.colors.textMuted,
  },
  statRowRight: {
    alignItems: 'flex-end',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statRowValue: {
    fontFamily: Theme.fonts.numberSemiBold,
    fontVariant: ['tabular-nums'],
    fontSize: 16,
  },
  statRowUnit: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  statRowSubValue: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
});
