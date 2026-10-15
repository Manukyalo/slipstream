/**
 * CircuitCardSkeleton — Loading placeholder for Circuit cards
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';

export function CircuitCardSkeleton() {
  const [opacityAnim] = useState(() => new Animated.Value(0.3));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  return (
    <Card style={styles.card}>
      <Animated.View style={[styles.inner, { opacity: opacityAnim }]}>
        <View style={styles.topRow}>
          <View style={styles.thumbPlaceholder} />
          <View style={styles.infoCol}>
            <View style={styles.badgePlaceholder} />
            <View style={styles.titlePlaceholder} />
            <View style={styles.subPlaceholder} />
          </View>
        </View>

        <View style={styles.stripPlaceholder} />
        <View style={styles.btnPlaceholder} />
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing[4],
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginBottom: Spacing[3],
  },
  inner: {
    gap: Spacing[3],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  thumbPlaceholder: {
    width: 92,
    height: 74,
    borderRadius: 16,
    backgroundColor: Colors.surface['2'],
  },
  infoCol: {
    flex: 1,
    gap: 8,
  },
  badgePlaceholder: {
    width: 80,
    height: 16,
    borderRadius: 6,
    backgroundColor: Colors.surface['2'],
  },
  titlePlaceholder: {
    width: '75%',
    height: 20,
    borderRadius: 6,
    backgroundColor: Colors.surface['2'],
  },
  subPlaceholder: {
    width: '50%',
    height: 14,
    borderRadius: 4,
    backgroundColor: Colors.surface['2'],
  },
  stripPlaceholder: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surface['2'],
  },
  btnPlaceholder: {
    width: 120,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surface['2'],
  },
});
