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
  Pressable,
} from 'react-native';
import { type ErrorBoundaryProps, router } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error/RouteErrorBoundary';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ShareRecapModal } from '@/components/recap/ShareRecapModal';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import { fetchRecentTrips } from '@/services/trips';
import { toUserMessage } from '@/utils/toUserMessage';
import type { Trip } from '@/types/database';
import type { GenerateRecapCardParams } from '@/services/shareCard';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}m`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TripCardProps {
  trip: Trip;
  onShare: () => void;
}

function TripCard({ trip, onShare }: TripCardProps) {
  const distKm = (Number(trip.distance_m) / 1000).toFixed(2);
  const topSpeed = Math.round(Number(trip.top_speed));
  const avgSpeed = Math.round(Number(trip.avg_speed));

  return (
    <View style={cardStyles.card}>
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={cardStyles.dateWrap}>
          <Icon name="flag" size={14} color={Colors.text.tertiary} />
          <Text variant="label" color={Colors.text.primary}>
            {formatDate(trip.started_at)}
          </Text>
        </View>
        <View style={cardStyles.durationBadge}>
          <Text variant="overline" color={Colors.accent.cyan}>
            {formatDuration(trip.duration_s)}
          </Text>
        </View>
      </View>

      {/* Metrics */}
      <View style={cardStyles.metrics}>
        <View style={cardStyles.metricItem}>
          <Text variant="metricL" color={Colors.text.primary} tabular style={cardStyles.metricValue}>
            {distKm}
          </Text>
          <Text variant="overline" color={Colors.text.tertiary} style={cardStyles.metricUnit}>
            KM
          </Text>
        </View>
        <View style={cardStyles.divider} />
        <View style={cardStyles.metricItem}>
          <Text variant="metricL" color={Colors.text.primary} tabular style={cardStyles.metricValue}>
            {topSpeed}
          </Text>
          <Text variant="overline" color={Colors.text.tertiary} style={cardStyles.metricUnit}>
            PEAK KM/H
          </Text>
        </View>
        <View style={cardStyles.divider} />
        <View style={cardStyles.metricItem}>
          <Text variant="metricL" color={Colors.text.primary} tabular style={cardStyles.metricValue}>
            {avgSpeed}
          </Text>
          <Text variant="overline" color={Colors.text.tertiary} style={cardStyles.metricUnit}>
            AVG KM/H
          </Text>
        </View>
      </View>

      {/* Share button */}
      <Pressable
        style={({ pressed }) => [cardStyles.shareBtn, pressed && cardStyles.btnPressed]}
        onPress={onShare}
      >
        <Icon name="share" size={14} color={Colors.accent.cyan} />
        <Text variant="overline" color={Colors.accent.cyan}>
          SHARE STORY CARD
        </Text>
      </Pressable>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
    gap: Spacing.gap,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  durationBadge: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  metricValue: {
    fontSize: 26,
    lineHeight: 30,
  },
  metricUnit: {
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.hairline,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.button,
    paddingVertical: 12,
    backgroundColor: 'rgba(34,211,238,0.06)',
  },
  btnPressed: {
    opacity: 0.75,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} screenTitle="Recap" />;
}

export default function RecapScreen() {
  const { user, profile } = useAuth();
  const { primaryVehicle } = useVehicles();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shareParams, setShareParams] = useState<GenerateRecapCardParams | null>(null);

  useEffect(() => {
    let active = true;
    fetchRecentTrips(50)
      .then((data) => {
        if (active) {
          setTrips(data);
          setErrorMsg(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(toUserMessage(err));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchRecentTrips(50);
      setTrips(data);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(toUserMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handle = profile?.display_name || user?.email?.split('@')[0] || 'pilot';
  const vehicleLabel = primaryVehicle
    ? `${primaryVehicle.make} ${primaryVehicle.model}`.trim()
    : 'Slipstream Vehicle';

  return (
    <ScreenContainer title="Recap">
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
