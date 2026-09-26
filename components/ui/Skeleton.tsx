import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Duration } from '@/constants/design';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkeletonProps {
  /** Width of the skeleton. Pass a number (px) or '100%'. */
  width: number | `${number}%`;
  /** Height of the skeleton. */
  height: number;
  /** Border radius. Defaults to 8. */
  borderRadius?: number;
  /** Optional override for the base background color. */
  baseColor?: string;
  /** Extra style overrides. */
  style?: object;
}

// ---------------------------------------------------------------------------
// Skeleton
//
// Usage:
//   <Skeleton width="100%" height={20} />
//   <Skeleton width={80} height={80} borderRadius={40} />   // avatar
//
// Every data-fetching screen uses this instead of an ActivityIndicator.
// ---------------------------------------------------------------------------

export function Skeleton({
  width,
  height,
  borderRadius = 8,
  baseColor = Colors.bgSurface,
  style,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: Duration.shimmer,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  // Translate the gradient from -width to +width across the element
  const resolvedWidth = typeof width === 'number' ? width : 300; // fallback for '%' strings
  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-resolvedWidth, resolvedWidth],
  });

  return (
    <View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
      >
        <LinearGradient
          colors={[
            'transparent',
            Colors.bgElevated,
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Compound components — pre-composed skeleton shapes for common layouts
// ---------------------------------------------------------------------------

/** A full-width card skeleton (list item) */
export function SkeletonCard({ style }: { style?: object }) {
  return (
    <View style={[styles.card, style]}>
      {/* Avatar */}
      <Skeleton width={44} height={44} borderRadius={22} />
      {/* Text block */}
      <View style={styles.cardText}>
        <Skeleton width="70%" height={14} borderRadius={4} />
        <Skeleton width="45%" height={12} borderRadius={4} style={styles.cardSubline} />
      </View>
    </View>
  );
}

/** A metric display skeleton (big number + label) */
export function SkeletonMetric({ style }: { style?: object }) {
  return (
    <View style={[styles.metric, style]}>
      <Skeleton width={80} height={36} borderRadius={6} />
      <Skeleton width={50} height={12} borderRadius={4} style={styles.metricLabel} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  cardText: {
    flex: 1,
    gap: 6,
  },
  cardSubline: {
    marginTop: 2,
  },
  metric: {
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    marginTop: 2,
  },
});
