import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function RecapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recap</Text>
        <Text style={styles.subtitle}>Recent Sessions & Driving Stats</Text>
      </View>

      <View style={styles.list}>
        <SkeletonCard />
        <SkeletonCard />
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
  list: {
    gap: Spacing.md,
  },
});
