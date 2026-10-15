/**
 * IconChip — 40×40 rounded container for a Phosphor icon
 *
 * Background = accent colour at 16% opacity (from Colors.tint.*).
 * Radius = 12 (Radius.iconChip).
 *
 * Usage:
 *   <IconChip name="gauge" color="cyan" />
 *   <IconChip name="warning" color="danger" size={20} chipSize={48} />
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import { Icon, type IconName, type IconWeight } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IconChipColor = keyof typeof COLOR_MAP;

interface IconChipProps {
  name: IconName;
  /** Semantic colour key — maps to a tint + foreground pair */
  color?: IconChipColor;
  /** Override chip size (default 40) */
  chipSize?: number;
  /** Override icon size (default 20) */
  size?: number;
  weight?: IconWeight;
  style?: ViewStyle;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour map
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  cyan:    { bg: Colors.tint.cyan,    icon: Colors.accent.cyan },
  blue:    { bg: Colors.tint.blue,    icon: Colors.accent.blue },
  success: { bg: Colors.tint.success, icon: Colors.semantic.success },
  warning: { bg: Colors.tint.warning, icon: Colors.semantic.warning },
  danger:  { bg: Colors.tint.danger,  icon: Colors.semantic.danger },
  violet:  { bg: Colors.tint.violet,  icon: Colors.semantic.violet },
  default: { bg: 'rgba(255,255,255,0.08)', icon: Colors.text.secondary },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function IconChip({
  name,
  color = 'default',
  chipSize = 40,
  size = 20,
  weight = 'duotone',
  style,
}: IconChipProps) {
  const { bg, icon } = COLOR_MAP[color];

  return (
    <View
      style={[
        styles.chip,
        {
          width:           chipSize,
          height:          chipSize,
          borderRadius:    Radius.iconChip,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={icon} weight={weight} />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems:     'center',
    justifyContent: 'center',
  },
});
