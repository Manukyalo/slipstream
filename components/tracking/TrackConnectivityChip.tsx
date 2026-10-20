/**
 * TrackConnectivityChip — Slim non-overlapping offline status and synced confirmation
 *
 * Requirements:
 * - Rendered below safe-area top inset (below top pill row), never over status bar or system icons.
 * - Exact wording when offline with pending records:
 *     "Offline. Your drive will sync when you're back online."
 * - Only shown if a drive/record is pending AND device is truly offline.
 * - Shows a quiet "Synced" chip with checkmark when queued records flush.
 * - Strictly uses theme tokens.
 */

import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import {
  subscribeToReachability,
  type ReachabilityState,
} from '@/services/networkReachability';

export function TrackConnectivityChip() {
  const [reachability, setReachability] = useState<ReachabilityState>({
    isTrulyOffline: false,
    pendingCount: 0,
    justSynced: false,
  });

  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = subscribeToReachability(setReachability);
    return () => unsubscribe();
  }, []);

  const shouldShow =
    (reachability.isTrulyOffline && reachability.pendingCount > 0) || reachability.justSynced;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, fadeAnim]);

  if (!shouldShow) {
    return null;
  }

  const isSynced = reachability.justSynced;

  return (
    <Animated.View
      style={[
        styles.chipContainer,
        {
          opacity: fadeAnim,
          borderColor: isSynced
            ? 'rgba(34, 197, 94, 0.3)'
            : 'rgba(245, 158, 11, 0.3)',
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {isSynced ? (
        <>
          <View style={[styles.iconWrap, styles.iconWrapSuccess]}>
            <Icon name="check" size={12} color={Colors.semantic.success} weight="bold" />
          </View>
          <Text variant="label" color={Colors.text.primary} style={styles.chipText}>
            Synced
          </Text>
        </>
      ) : (
        <>
          <View style={[styles.iconWrap, styles.iconWrapWarning]}>
            <View style={styles.dotWarning} />
          </View>
          <Text variant="label" color={Colors.text.primary} style={styles.chipText}>
            {"Offline. Your drive will sync when you're back online."}
          </Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 19, 27, 0.94)',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 5,
    paddingHorizontal: Spacing[3],
    alignSelf: 'center',
    gap: Spacing[2],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    maxWidth: '92%',
  },
  iconWrap: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  iconWrapWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  dotWarning: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.warning,
  },
  chipText: {
    ...Typography.label,
    fontSize: 11.5,
    fontFamily: FontFamily.label,
    letterSpacing: 0.2,
  },
});
