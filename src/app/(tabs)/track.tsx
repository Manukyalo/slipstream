import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { Skeleton, SkeletonCard, SkeletonMetric } from '@/components/ui/Skeleton';

export default function TrackScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Track</Text>
        <Text style={styles.subtitle}>Map & Live Telemetry</Text>
      </View>

      <View style={styles.metricsRow}>
        <SkeletonMetric style={styles.metricCard} />
        <SkeletonMetric style={styles.metricCard} />
        <SkeletonMetric style={styles.metricCard} />
      </View>

      <View style={styles.mapPlaceholder}>
        <Skeleton width="100%" height={260} borderRadius={16} />
      </View>

      <View style={styles.cardsSection}>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  metricCard: {
    backgroundColor: Colors.bgSurface,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: '30%',
  },
  mapPlaceholder: {
    marginBottom: Spacing.lg,
  },
  cardsSection: {
    gap: Spacing.sm,
  },
});
