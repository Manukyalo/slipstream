import React from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';

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

export function HeroStat({
  value,
  unit,
  label,
  accentColor = '#EDEFF3',
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

const styles = StyleSheet.create({
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
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#7B8493',
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
    fontFamily: 'SpaceGrotesk_700Bold',
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
    fontFamily: 'Inter_500Medium',
    color: '#7B8493',
  },
  unitHero: {
    fontSize: 16,
    marginLeft: 4,
  },
  unitMedium: {
    fontSize: 12,
    marginLeft: 2,
  },
});
