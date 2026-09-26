import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { supabase } from '@/lib/supabase';
import { Trip } from '@/types/database';

export default function RecapScreen() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrips = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('started_at', { ascending: false });

      if (error) {
        console.warn('[Recap] Error fetching trips:', error.message);
      } else if (data) {
        setTrips(data);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrips();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recap</Text>
        <Text style={styles.subtitle}>Recorded Driving Sessions & Telemetry</Text>
      </View>

      {loading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>NO TRIPS RECORDED</Text>
          <Text style={styles.emptyBody}>
            Switch to the Track tab and hit Start Tracking to record your first session.
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accentCyan}
            />
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.tripCard}>
              <View style={styles.tripCardHeader}>
                <Text style={styles.tripDate}>{formatDate(item.started_at)}</Text>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{formatDuration(item.duration_s)}</Text>
                </View>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>
                    {(Number(item.distance_m) / 1000).toFixed(2)}
                  </Text>
                  <Text style={styles.metricUnit}>KM</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{Math.round(Number(item.top_speed))}</Text>
                  <Text style={styles.metricUnit}>PEAK KM/H</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{Math.round(Number(item.avg_speed))}</Text>
                  <Text style={styles.metricUnit}>AVG KM/H</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
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
  skeletonContainer: {
    gap: Spacing.md,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: 80,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  emptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: Spacing['2xl'],
    gap: Spacing.md,
  },
  tripCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 16,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    paddingBottom: Spacing.sm,
  },
  tripDate: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textPrimary,
  },
  durationBadge: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  durationText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  metricUnit: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
});
