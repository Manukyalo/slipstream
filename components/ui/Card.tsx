/**
 * Card — L1 surface container
 *
 * bg = surface.1, radius = 24, 1px hairline border.
 * Optional `glow` prop adds the hero cyan shadow (L2 + glow).
 * Optional `elevated` prop upgrades to L2 (soft drop shadow).
 *
 * Usage:
 *   <Card>
 *     <Text variant="heading">Fastest Lap</Text>
 *   </Card>
 *
 *   <Card glow>
 *     <Text variant="metricXL" color={Colors.accent.cyan}>237</Text>
 *   </Card>
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { Colors, Radius, Spacing, Depth } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  /** Upgrade to L2 shadow */
  elevated?: boolean;
  /** Add hero cyan glow — use only on the primary metric element */
  glow?: boolean;
  /** Extra style overrides */
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, elevated = false, glow = false, style }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        glow && styles.glow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius:    Radius.card,
    padding:         Spacing.card,
    ...Depth.L1,
  },
  elevated: {
    backgroundColor: Colors.surface['2'],
    ...Depth.L2,
  },
  glow: {
    ...Depth.heroGlow,
  },
});
