/**
 * Button — primary interactive control
 *
 * Variants:
 *   primary  — LinearGradient cyan→blue, white label (default)
 *   secondary — surface.2 + hairline border, primary text
 *   ghost    — no fill, cyan label
 *   danger   — danger red fill, white label
 *
 * Height: 56. Radius: 18. Haptic on every press.
 * Loading state replaces label with a spinner and disables the button.
 *
 * Usage:
 *   <Button onPress={handleStart}>Start Session</Button>
 *   <Button variant="secondary" onPress={handleCancel}>Cancel</Button>
 *   <Button variant="danger" loading={isDeleting} onPress={handleDelete}>Delete</Button>
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing, Gradient } from '@/constants/theme';
import { Text } from './Text';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Icon to render before the label */
  iconLeft?: React.ReactNode;
  /** Override the container style */
  style?: StyleProp<ViewStyle>;
  /** Full-width by default; set to true to shrink-wrap */
  compact?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour config per variant
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_LABEL_COLOR: Record<ButtonVariant, string> = {
  primary:   Colors.text.inverse,
  secondary: Colors.text.primary,
  ghost:     Colors.accent.cyan,
  danger:    '#FFFFFF',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function Button({
  children,
  variant = 'primary',
  onPress,
  loading = false,
  disabled = false,
  iconLeft,
  style,
  compact = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  async function handlePress() {
    if (isDisabled) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }

  const labelColor = VARIANT_LABEL_COLOR[variant];

  const inner = (
    <View style={[styles.inner, loading && styles.innerLoading]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? Colors.text.inverse : Colors.accent.cyan}
          size="small"
        />
      ) : (
        <>
          {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
          <Text
            variant="label"
            color={labelColor}
            style={styles.label}
          >
            {children as string}
          </Text>
        </>
      )}
    </View>
  );

  const accLabel =
    typeof children === 'string' ? children : undefined;

  if (variant === 'primary') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={accLabel}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[styles.base, compact && styles.compact, isDisabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={Gradient.accent.colors}
          start={Gradient.accent.start}
          end={Gradient.accent.end}
          style={StyleSheet.absoluteFill}
        />
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        compact && styles.compact,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost'     && styles.ghost,
        variant === 'danger'    && styles.danger,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {inner}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  base: {
    height:         56,
    borderRadius:   Radius.button,
    overflow:       'hidden',
    alignSelf:      'stretch',
    justifyContent: 'center',
  },
  compact: {
    alignSelf:       'flex-start',
    paddingHorizontal: Spacing[5],
  },
  inner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing[2],
    paddingHorizontal: Spacing.card,
    flex:           1,
  },
  innerLoading: {
    gap: 0,
  },
  label: {
    fontSize:   15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  iconLeft: {
    marginRight: 2,
  },
  // Variant fills
  secondary: {
    backgroundColor: Colors.surface['2'],
    borderWidth:     1,
    borderColor:     Colors.hairline,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.semantic.danger,
  },
  disabled: {
    opacity: 0.45,
  },
});
