/**
 * RouteErrorBoundary — Expo Router screen-level error boundary
 *
 * Traps runtime errors thrown during module evaluation or rendering of a route,
 * logs the exception with context, and provides user-friendly retry & navigation actions.
 * Guarantees the app never renders a blank unstyled navigator screen.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { type ErrorBoundaryProps, router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

interface RouteErrorBoundaryCustomProps extends ErrorBoundaryProps {
  screenTitle?: string;
}

export function RouteErrorBoundary({
  error,
  retry,
  screenTitle = 'Screen Error',
}: RouteErrorBoundaryCustomProps) {
  useEffect(() => {
    // Log the raw error with stack for diagnostics and telemetry
    console.error(`[RouteErrorBoundary][${screenTitle}] Caught route exception:`, error);
  }, [error, screenTitle]);

  return (
    <ScreenContainer title={screenTitle} scrollable contentStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Icon name="warning" size={32} color={Colors.semantic.danger} weight="duotone" />
        </View>

        <Text variant="title" color={Colors.text.primary} style={styles.title}>
          Unable to Load Screen
        </Text>

        <Text variant="body" color={Colors.text.secondary} style={styles.description}>
          An unexpected error occurred while preparing this view. You can try reloading or return to the track telemetry dashboard.
        </Text>

        <View style={styles.errorBox}>
          <Text variant="label" color={Colors.semantic.danger} style={styles.errorText} numberOfLines={4}>
            {error?.message || 'Unknown runtime error'}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <Button
            variant="primary"
            onPress={retry}
            iconLeft={<Icon name="refresh" size={16} color={Colors.bg.base} />}
            style={styles.actionBtn}
          >
            Try Again
          </Button>

          <Button
            variant="secondary"
            onPress={() => router.replace('/(tabs)/track')}
            iconLeft={<Icon name="arrow-left" size={16} color={Colors.text.primary} />}
            style={styles.actionBtn}
          >
            Go to Track
          </Button>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.section,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing[4],
    alignItems: 'center',
    width: '100%',
    gap: Spacing[3],
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[1],
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 20,
  },
  errorBox: {
    width: '100%',
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.button,
    padding: Spacing[3],
    borderLeftWidth: 3,
    borderLeftColor: Colors.semantic.danger,
    marginVertical: Spacing[1],
  },
  errorText: {
    fontSize: 12,
  },
  actionRow: {
    width: '100%',
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  actionBtn: {
    width: '100%',
  },
});
