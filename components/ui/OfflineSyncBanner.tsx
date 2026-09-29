import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { subscribeToQueueStatus, type QueueStatus } from '@/services/offlineQueue';

export function OfflineSyncBanner() {
  const [status, setStatus] = useState<QueueStatus>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [showSyncedSuccess, setShowSyncedSuccess] = useState<boolean>(false);
  const prevCountRef = useRef<number>(0);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = subscribeToQueueStatus((newStatus, count) => {
      if (prevCountRef.current > 0 && count === 0 && newStatus === 'idle') {
        setShowSyncedSuccess(true);
        setTimeout(() => {
          setShowSyncedSuccess(false);
        }, 2500);
      }
      prevCountRef.current = count;
      setStatus(newStatus);
      setPendingCount(count);
    });

    return () => unsubscribe();
  }, []);

  const isVisible = pendingCount > 0 || status === 'syncing' || showSyncedSuccess;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isVisible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isVisible, fadeAnim]);

  if (!isVisible) {
    return null;
  }

  let text = '';
  let dotColor: string = Colors.accentCyan;

  if (showSyncedSuccess) {
    text = '✓ All offline telemetry synced';
    dotColor = Colors.accentGreen;
  } else if (status === 'syncing') {
    text = `Syncing ${pendingCount} offline ${pendingCount === 1 ? 'record' : 'records'}…`;
    dotColor = Colors.accentCyan;
  } else if (status === 'error') {
    text = `Sync paused · ${pendingCount} records queued`;
    dotColor = Colors.accentOrange;
  } else if (pendingCount > 0) {
    text = `Offline · ${pendingCount} ${pendingCount === 1 ? 'record' : 'records'} buffered`;
    dotColor = Colors.textMuted;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSurface,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
});
