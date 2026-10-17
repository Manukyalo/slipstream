/**
 * EmptyState — zero-data placeholder
 *
 * Centred layout: IconChip + heading + body + optional CTA button.
 * No emoji. Never a blank screen.
 *
 * Usage:
 *   <EmptyState
 *     icon="path"
 *     iconColor="cyan"
 *     title="No trips yet"
 *     description="Complete your first drive to see your history here."
 *     action={{ label: 'Start a trip', onPress: handleStart }}
 *   />
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { IconChip, type IconChipColor } from './IconChip';
import { Text } from './Text';
import { Button } from './Button';
import type { IconName } from './Icon';

interface EmptyStateAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
}

interface EmptyStateProps {
  icon?: IconName;
  iconColor?: IconChipColor;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  style?: ViewStyle;
}

export function EmptyState({
  icon = 'info',
  iconColor = 'default',
  title,
  description,
  action,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <IconChip name={icon} color={iconColor} chipSize={56} size={28} />

      <View style={styles.textBlock}>
        <Text variant="heading" centered>
          {title}
        </Text>
        {description && (
          <Text variant="body" color={Colors.text.secondary} centered style={styles.description}>
            {description}
          </Text>
        )}
      </View>

      {action && (
        <View style={action.fullWidth ? styles.actionFullWidthWrap : undefined}>
          <Button
            variant={action.variant ?? 'secondary'}
            onPress={action.onPress}
            style={[styles.action, action.fullWidth && styles.actionFullWidth]}
            compact={!action.fullWidth}
          >
            {action.label}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        Spacing.screen,
    gap:            Spacing[4],
  },
  textBlock: {
    gap:       Spacing[2],
    alignItems: 'center',
    maxWidth:  280,
  },
  description: {
    lineHeight: 22,
  },
  action: {
    marginTop: Spacing[2],
  },
  actionFullWidthWrap: {
    width: '100%',
    paddingHorizontal: Spacing.screen,
    alignItems: 'center',
  },
  actionFullWidth: {
    width: '100%',
  },
});
