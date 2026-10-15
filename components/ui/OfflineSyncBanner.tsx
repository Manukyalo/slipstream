import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { Text } from './Text';
import { Icon } from './Icon';
import { subscribeToQueueStatus, type QueueStatus } from '@/services/offlineQueue';

export function OfflineSyncBanner() {
  const [status, setStatus] = useState<QueueStatus>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showSyncedSuccess, setShowSyncedSuccess] = useState<boolean>(false);
  const prevCountRef = useRef<number>(0);
  const [fadeAnim] = useState(() => new Animated.Value(0));

  // Listen to queue status
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

  // Listen to network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
    });

    return () => unsubscribe();
  }, []);

  const isVisible = !isOnline || pendingCount > 0 || status === 'syncing' || showSyncedSuccess;

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
  let dotColor: string = Colors.accent.cyan;
  let showCheck = false;

  if (showSyncedSuccess) {
    text = 'Back online · All telemetry synced';
    dotColor = Colors.semantic.success;
    showCheck = true;
  } else if (status === 'syncing') {
    text = `Syncing ${pendingCount} offline ${pendingCount === 1 ? 'record' : 'records'}…`;
    dotColor = Colors.accent.cyan;
  } else if (!isOnline) {
    text = pendingCount > 0
      ? `Offline · ${pendingCount} ${pendingCount === 1 ? 'record' : 'records'} buffered`
      : 'Offline mode · Telemetry saved locally';
    dotColor = Colors.semantic.warning;
  } else if (status === 'error') {
    text = `Sync paused · ${pendingCount} records queued`;
    dotColor = Colors.semantic.warning;
  } else if (pendingCount > 0) {
    text = `Offline · ${pendingCount} ${pendingCount === 1 ? 'record' : 'records'} buffered`;
    dotColor = Colors.text.tertiary;
  }

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {showCheck ? (
        <Icon name="check" size={12} color={Colors.semantic.success} weight="bold" />
      ) : (
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      )}
      <Text variant="label" color={Colors.text.secondary} style={styles.text}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface['1'],
    paddingVertical: Spacing[1],
    paddingHorizontal: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    gap: Spacing[2],
    minHeight: 30,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: FontFamily.label,
    letterSpacing: 0.3,
  },
});
