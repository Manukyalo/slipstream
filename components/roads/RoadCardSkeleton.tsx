import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Skeleton } from '@/components/ui/Skeleton';

export function RoadCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Thumbnail placeholder */}
      <Skeleton width="100%" height={115} borderRadius={12} baseColor={Colors.surface[2]} />

      <View style={styles.content}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <Skeleton width="65%" height={20} borderRadius={6} baseColor={Colors.surface[2]} />
          <Skeleton width={50} height={18} borderRadius={6} baseColor={Colors.surface[2]} />
        </View>

        {/* Description line */}
        <Skeleton width="85%" height={14} borderRadius={4} baseColor={Colors.surface[2]} />

        {/* 4 Metric items row */}
        <View style={styles.metricsRow}>
          <Skeleton width="22%" height={36} borderRadius={8} baseColor={Colors.surface[2]} />
          <Skeleton width="22%" height={36} borderRadius={8} baseColor={Colors.surface[2]} />
          <Skeleton width="22%" height={36} borderRadius={8} baseColor={Colors.surface[2]} />
          <Skeleton width="22%" height={36} borderRadius={8} baseColor={Colors.surface[2]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface[1],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: 'hidden',
    marginBottom: Spacing[4],
    padding: Spacing[3],
    gap: 10,
  },
  content: {
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
});
