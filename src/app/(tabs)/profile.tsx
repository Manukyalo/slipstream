/**
 * Profile Screen — Phase 8
 *
 * Full driver stats dashboard:
 *  - Profile header card: avatar ring (cyan gradient), handle, country & car, level chip
 *  - Period selector: Week · Month · Year · All
 *  - Hero distance card with SVG sparkline
 *  - 2-column stat grid (Distance, Duration, Stopped, Trips)
 *  - Top speed card with mini Gauge (size 160)
 *  - Driving style section (DrivingStyleCard)
 *  - Settings cog in headerRight, share button for story card
 *
 * Zero-data state: dashes (—) + "Drive to see your stats"
 * All errors routed through toUserMessage(); raw errors logged only.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  View,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { type ErrorBoundaryProps, router } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error/RouteErrorBoundary';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradient, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { ClusterGauge } from '@/components/ui/ClusterGauge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { MetricCard } from '@/components/stats/MetricCard';
import { Sparkline } from '@/components/stats/Sparkline';
import { DrivingStyleCard } from '@/components/stats/DrivingStyleCard';
import { ShareRecapModal } from '@/components/recap/ShareRecapModal';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicleContext } from '@/contexts/VehicleContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { toUserMessage } from '@/utils/toUserMessage';
import {
  fetchUserPeriodStats,
  type PeriodStats,
  type StatsPeriod,
} from '@/services/profileStats';
import type { GenerateRecapCardParams } from '@/services/shareCard';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PERIODS: { label: string; value: StatsPeriod }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
  { label: 'All', value: 'all' },
];

function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    return `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProfileHeader — avatar ring + metadata
// ─────────────────────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  handle: string;
  level: number;
  streakDays: number;
  vehicleName: string;
  country?: string;
  avatarUrl?: string | null;
}

function ProfileHeader({
  handle,
  level,
  streakDays,
  vehicleName,
  country,
  avatarUrl,
}: ProfileHeaderProps) {
  const initial = handle.replace(/^@/, '').charAt(0).toUpperCase() || 'S';
  const locationLine = [country, vehicleName].filter(Boolean).join('  ·  ');

  return (
    <View style={headerStyles.card}>
      {/* Avatar with gradient ring */}
      <LinearGradient
        colors={Gradient.accent.colors}
        start={Gradient.accent.start}
        end={Gradient.accent.end}
        style={headerStyles.avatarRing}
      >
        <View style={headerStyles.avatarInner}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={headerStyles.avatarImage} resizeMode="cover" />
          ) : (
            <Text variant="display" color={Colors.accent.cyan} style={headerStyles.avatarInitial}>
              {initial}
            </Text>
          )}
        </View>
      </LinearGradient>

      {/* Name + meta */}
      <View style={headerStyles.meta}>
        <Text variant="title" color={Colors.text.primary} style={headerStyles.handle} numberOfLines={1}>
          {handle.startsWith('@') ? handle : `@${handle}`}
        </Text>
        {locationLine ? (
          <Text variant="label" color={Colors.text.secondary} numberOfLines={1}>
            {locationLine}
          </Text>
        ) : null}

        {/* Level + Streak chips */}
        <View style={headerStyles.chipsRow}>
          <View style={headerStyles.chip}>
            <Icon name="trophy" size={12} color={Colors.accent.cyan} />
            <Text variant="overline" color={Colors.accent.cyan}>
              LV {level}
            </Text>
          </View>
          {streakDays > 0 && (
            <View style={headerStyles.chip}>
              <Icon name="lightning" size={12} color={Colors.semantic.warning} />
              <Text variant="overline" color={Colors.semantic.warning}>
                {streakDays}D STREAK
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[4],
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  avatarInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: Colors.bg.base,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 30,
    lineHeight: 36,
  },
  meta: {
    flex: 1,
    gap: Spacing[1],
  },
  handle: {
    fontSize: 22,
    lineHeight: 28,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.gap,
    marginTop: Spacing[1],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface['2'],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Hero Distance Card
// ─────────────────────────────────────────────────────────────────────────────

function HeroDistanceCard({
  distanceKm,
  sparkline,
  hasData,
}: {
  distanceKm: number;
  sparkline: number[];
  hasData: boolean;
}) {
  const { convertDistanceKm, distanceUnitLabel } = usePreferences();
  const displayValue = hasData ? convertDistanceKm(distanceKm).toFixed(1) : '—';

  return (
    <View style={heroStyles.card}>
      <View style={heroStyles.top}>
        <View>
          <Text variant="label" color={Colors.text.tertiary} style={heroStyles.label}>
            Total Distance
          </Text>
          <View style={heroStyles.valueRow}>
            <Text variant="metricXL" color={hasData ? Colors.text.primary : Colors.text.tertiary} tabular>
              {displayValue}
            </Text>
            {hasData && (
              <Text variant="heading" color={Colors.text.tertiary} style={heroStyles.unit}>
                {distanceUnitLabel}
              </Text>
            )}
          </View>
        </View>
      </View>
      <Sparkline
        data={sparkline}
        height={52}
        style={heroStyles.sparkline}
      />
      {!hasData && (
        <Text variant="label" color={Colors.text.tertiary} style={heroStyles.emptyHint}>
          Drive to see your stats
        </Text>
      )}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
    overflow: 'hidden',
  },
  top: {
    marginBottom: Spacing.gap,
  },
  label: {
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  unit: {
    fontSize: 22,
    lineHeight: 28,
  },
  sparkline: {
    marginHorizontal: -Spacing.card,
  },
  emptyHint: {
    textAlign: 'center',
    marginTop: Spacing[2],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Top Speed Card
// ─────────────────────────────────────────────────────────────────────────────

function TopSpeedCard({ speedKmh, hasData }: { speedKmh: number; hasData: boolean }) {
  return (
    <View style={speedStyles.card}>
      <ClusterGauge
        mode="peak"
        speedKmh={speedKmh}
        hasData={hasData}
      />
    </View>
  );
}

const speedStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} screenTitle="Profile" />;
}

export default function ProfileScreen() {
  const { user, profile } = useAuth();
  const { primaryVehicle, avatarSource } = useVehicleContext();
  const { convertDistanceKm, distanceUnitLabel } = usePreferences();
  const [periodIndex, setPeriodIndex] = useState(0);
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shareParams, setShareParams] = useState<GenerateRecapCardParams | null>(null);

  const avatarUrl = useMemo(() => {
    if (avatarSource === 'car') {
      return primaryVehicle?.photo_url ?? null;
    }
    if (avatarSource === 'custom') {
      return profile?.avatar_url ?? null;
    }
    return null;
  }, [avatarSource, primaryVehicle?.photo_url, profile?.avatar_url]);

  const period = PERIODS[periodIndex].value;

  const handlePeriodChange = useCallback((index: number) => {
    setPeriodIndex(index);
    setLoadingStats(true);
  }, []);

  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      return;
    }

    fetchUserPeriodStats(user.id, period)
      .then((result) => {
        if (active) {
          setStats(result);
          setStatsError(null);
          setLoadingStats(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error('[Profile] Failed to load stats:', err);
          setStatsError(toUserMessage(err));
          setLoadingStats(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user, period]);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    setStatsError(null);
    try {
      const result = await fetchUserPeriodStats(user.id, period);
      setStats(result);
    } catch (err) {
      console.error('[Profile] Failed to refresh stats:', err);
      setStatsError(toUserMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [user, period]);

  const handle = profile?.display_name || user?.email?.split('@')[0] || 'pilot';
  const vehicleLabel = primaryVehicle
    ? `${primaryVehicle.make} ${primaryVehicle.model}`.trim()
    : 'No vehicle set';

  const shareRecap = useMemo<GenerateRecapCardParams | null>(() => {
    if (!stats?.hasData) return null;
    return {
      type: 'trip',
      userHandle: handle,
      vehicleName: vehicleLabel,
      country: 'Kenya',
      topSpeedKmh: stats.topSpeedKmh,
      avgSpeedKmh: stats.avgSpeedKmh,
      distanceMeters: stats.totalDistanceKm * 1000,
      durationSeconds: stats.totalDurationSeconds,
    };
  }, [stats, handle, vehicleLabel]);

  const headerRight = (
    <View style={styles.headerActions}>
      {shareRecap && (
        <Pressable
          hitSlop={12}
          onPress={() => setShareParams(shareRecap)}
          accessibilityRole="button"
          accessibilityLabel="Share profile recap"
          style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
        >
          <Icon name="share" size={22} color={Colors.text.secondary} />
        </Pressable>
      )}
      <Pressable
        hitSlop={12}
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        style={({ pressed }) => [styles.headerBtn, pressed && styles.btnPressed]}
      >
        <Icon name="gear" size={22} color={Colors.text.secondary} />
      </Pressable>
    </View>
  );

  const hasData = Boolean(stats?.hasData);
  const isStatsLoading = loadingStats || (Boolean(user?.id) && stats === null && statsError === null);

  return (
    <ScreenContainer
      title="Profile"
      headerRight={headerRight}
      scrollable
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.cyan}
          />
        ),
        showsVerticalScrollIndicator: false,
      }}
      contentStyle={styles.scrollContent}
    >
      {/* Profile Header */}
      <ProfileHeader
        handle={handle}
        level={stats?.driverLevel ?? 1}
        streakDays={stats?.streakDays ?? 0}
        vehicleName={vehicleLabel}
        country="Kenya"
        avatarUrl={avatarUrl}
      />

      {/* Period Selector */}
      <Segmented
        options={PERIODS.map((p) => p.label)}
        selected={periodIndex}
        onChange={handlePeriodChange}
      />

      {/* Loading shimmer */}
      {isStatsLoading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : statsError && !stats ? (
        <ErrorState message={statsError} onRetry={onRefresh} />
      ) : (
        <>
          {/* Hero Distance */}
          <HeroDistanceCard
            distanceKm={stats?.totalDistanceKm ?? 0}
            sparkline={stats?.sparkline ?? [0, 0, 0, 0, 0, 0, 0]}
            hasData={hasData}
          />

          {/* 2-Column Metric Grid */}
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="path"
              iconColor="cyan"
              label="Distance"
              numericValue={stats?.totalDistanceKm ?? null}
              displayValue={
                hasData
                  ? convertDistanceKm(stats!.totalDistanceKm).toFixed(1)
                  : undefined
              }
              unit={distanceUnitLabel}
              hasData={hasData}
              style={styles.metricHalf}
            />
            <MetricCard
              icon="timer"
              iconColor="blue"
              label="Drive Time"
              numericValue={stats?.totalDurationSeconds ?? null}
              displayValue={hasData ? formatDuration(stats!.totalDurationSeconds) : undefined}
              hasData={hasData}
              style={styles.metricHalf}
            />
          </View>
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="pause"
              iconColor="warning"
              label="Stopped Time"
              numericValue={stats?.stoppedDurationSeconds ?? null}
              displayValue={hasData ? formatDuration(stats!.stoppedDurationSeconds) : undefined}
              hasData={hasData}
              style={styles.metricHalf}
            />
            <MetricCard
              icon="flag"
              iconColor="success"
              label="Trips"
              numericValue={stats?.tripCount ?? null}
              unit="trips"
              hasData={hasData}
              style={styles.metricHalf}
            />
          </View>

          {/* Top Speed */}
          <TopSpeedCard speedKmh={stats?.topSpeedKmh ?? 0} hasData={hasData} />

          {/* Driving Style */}
          {stats && (
            <DrivingStyleCard stats={stats.drivingStyle} hasData={hasData} />
          )}

          {/* Zero-data prompt */}
          {!hasData && !loadingStats && (
            <View style={styles.emptyNote}>
              <Icon name="car" size={28} color={Colors.text.tertiary} />
              <Text variant="label" color={Colors.text.tertiary} style={styles.emptyText}>
                Start a trip to see your telemetry and performance stats
              </Text>
            </View>
          )}
        </>
      )}

      {/* Share Story Modal */}
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
  scrollContent: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing.gap,
    paddingTop: Spacing.gap,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  headerBtn: {
    padding: Spacing[2],
  },
  btnPressed: {
    opacity: 0.7,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.gap,
  },
  metricHalf: {
    flex: 1,
  },
  skeletonContainer: {
    gap: Spacing.gap,
    paddingVertical: Spacing[2],
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: Spacing[3],
  },
  loadingText: {
    marginTop: Spacing[2],
  },
  emptyNote: {
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing.section,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
