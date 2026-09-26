import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { Skeleton, SkeletonMetric } from '@/components/ui/Skeleton';

export default function DragRaceScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Drag Race</Text>
        <Text style={styles.subtitle}>0-60, 0-100 & 1/4 Mile Telemetry</Text>
      </View>

      <View style={styles.heroBox}>
        <Skeleton width="100%" height={160} borderRadius={16} />
      </View>

      <View style={styles.metricsRow}>
        <SkeletonMetric style={styles.metricCard} />
        <SkeletonMetric style={styles.metricCard} />
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
  heroBox: {
    marginBottom: Spacing.xl,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
