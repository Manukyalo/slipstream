/**
 * Recap Screen — Recorded sessions & telemetry
 *
 * Lists all trips in reverse chronological order.
 * Each card shows date, distance, peak and avg speed, duration,
 * and a "Share Story Card" button that opens the on-device ShareRecapModal.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { type ErrorBoundaryProps, router } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error/RouteErrorBoundary';
import { Colors, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { FilterChip } from '@/components/ui/FilterChip';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ShareRecapModal } from '@/components/recap/ShareRecapModal';
import { TripCard } from '@/components/recap/TripCard';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicleContext } from '@/contexts/VehicleContext';
import { fetchRecentTrips } from '@/services/trips';
import { toUserMessage } from '@/utils/toUserMessage';
import type { Trip } from '@/types/database';
import type { GenerateRecapCardParams } from '@/services/shareCard';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} screenTitle="Recap" />;
}

export default function RecapScreen() {
  const { user, profile } = useAuth();
  const { vehicles, primaryVehicle } = useVehicleContext();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shareParams, setShareParams] = useState<GenerateRecapCardParams | null>(null);

  const loadTrips = useCallback(async (vId?: string | null) => {
    try {
      const data = await fetchRecentTrips(50, vId);
      setTrips(data);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(toUserMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchRecentTrips(50, selectedVehicleId)
      .then((data) => {
        if (!active) return;
        setTrips(data);
        setErrorMsg(null);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(toUserMessage(err));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [selectedVehicleId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTrips(selectedVehicleId);
  }, [selectedVehicleId, loadTrips]);

  const handle = profile?.display_name || user?.email?.split('@')[0] || 'pilot';
  const vehicleLabel = primaryVehicle
    ? `${primaryVehicle.make} ${primaryVehicle.model}`.trim()
    : 'Slipstream Vehicle';

  return (
    <ScreenContainer title="Recap">
      {/* Vehicle Filter Bar */}
      {vehicles.length > 0 && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <FilterChip
              label="All Cars"
              active={selectedVehicleId === null}
              onPress={() => setSelectedVehicleId(null)}
            />
            {vehicles.map((v) => (
              <FilterChip
                key={v.id}
                label={v.nickname || `${v.make} ${v.model}`}
                active={selectedVehicleId === v.id}
                onPress={() => setSelectedVehicleId(v.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}
      {loading ? (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : errorMsg && trips.length === 0 ? (
        <ErrorState message={errorMsg} onRetry={onRefresh} style={styles.stateWrap} />
      ) : trips.length === 0 ? (
        <EmptyState
          icon="flag"
          iconColor="cyan"
          title="No trips recorded"
          description="Start driving to record telemetry, calculate speed metrics, and build your recap."
          action={{
            label: 'Start Tracking',
            onPress: () => router.push('/(tabs)/track'),
          }}
          style={styles.stateWrap}
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accent.cyan}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onShare={() =>
                setShareParams({
                  type: 'trip',
                  id: item.id,
                  userHandle: handle,
                  vehicleName: vehicleLabel,
                  country: 'Kenya',
                  topSpeedKmh: Number(item.top_speed),
                  avgSpeedKmh: Number(item.avg_speed),
                  distanceMeters: Number(item.distance_m),
                  durationSeconds: item.duration_s,
                })
              }
            />
          )}
        />
      )}

      <ShareRecapModal
        visible={!!shareParams}
        params={shareParams}
        userHandle={handle}
        vehicleName={vehicleLabel}
        country="Kenya"
        onClose={() => setShareParams(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    paddingVertical: Spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  filterContent: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing[2],
  },
  skeletonWrap: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.gap,
    gap: Spacing.gap,
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[10],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screen * 2,
    gap: Spacing[4],
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 24,
    color: Colors.text.tertiary,
  },
  listContent: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.gap,
    paddingBottom: 40,
    gap: Spacing.gap,
  },
});
