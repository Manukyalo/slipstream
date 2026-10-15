/**
 * ErrorState — user-facing error placeholder
 *
 * Same layout as EmptyState but uses danger red IconChip.
 * CRITICAL: message MUST come from toUserMessage(error) — never a raw exception.
 *
 * Usage:
 *   <ErrorState
 *     message={toUserMessage(error)}
 *     onRetry={refetch}
 *   />
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { IconChip } from './IconChip';
import { Text } from './Text';
import { Button } from './Button';

interface ErrorStateProps {
  /** MUST be a user-friendly message from toUserMessage(). Never a raw exception. */
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <IconChip name="x-circle" color="danger" chipSize={56} size={28} />

      <View style={styles.textBlock}>
        <Text variant="heading" centered>
          Something went wrong
        </Text>
        <Text variant="body" color={Colors.text.secondary} centered style={styles.message}>
          {message}
        </Text>
      </View>

      {onRetry && (
        <Button variant="secondary" onPress={onRetry} compact style={styles.retry}>
          Try again
        </Button>
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
  message: {
    lineHeight: 22,
  },
  retry: {
    marginTop: Spacing[2],
  },
});
