/**
 * Text — typed typography variants
 *
 * Never write fontFamily, fontSize or lineHeight inline in a screen.
 * Pick a variant and let this component apply the correct style.
 *
 * Usage:
 *   <Text variant="heading">Favorite Roads</Text>
 *   <Text variant="metricXL" color={Colors.accent.cyan} tabular>0.0</Text>
 *   <Text variant="overline" color={Colors.text.secondary}>Section Title</Text>
 */

import React from 'react';
import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { Typography, Colors } from '@/constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TextVariant = keyof typeof Typography;

interface TextProps extends Omit<RNTextProps, 'style'> {
  variant?: TextVariant;
  /** Colour override — defaults to Colors.text.primary */
  color?: string;
  /** Enables tabular-nums for numeric readouts. Auto-applied for metricXL and metricL. */
  tabular?: boolean;
  /** Shorthand for textAlign: 'center' */
  centered?: boolean;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Text({
  variant = 'body',
  color,
  tabular,
  centered,
  maxFontSizeMultiplier = 1.35,
  style,
  children,
  ...rest
}: TextProps) {
  const variantStyle = Typography[variant];
  const isAlwaysTabular = variant === 'metricXL' || variant === 'metricL';
  const resolvedColor = color ?? Colors.text.primary;

  const composedStyle: TextStyle = {
    ...variantStyle,
    color: resolvedColor,
    ...(centered ? { textAlign: 'center' } : {}),
    ...(tabular || isAlwaysTabular ? { fontVariant: ['tabular-nums'] } : {}),
  };

  return (
    <RNText
      style={[composedStyle, style]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
    >
      {children}
    </RNText>
  );
}
