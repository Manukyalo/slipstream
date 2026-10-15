/**
 * RankingsScreen — Phase 7
 *
 * Leaderboards:
 *  - Three tabs: Top Speed · Drag · Distance (via Segmented)
 *  - Period chips: Week · Month · All
 *  - Scope chips: Global · Same Car
 *  - Drag distance sub-chips: ¼ mi · ½ mi · 1 mi
 *
 * Features:
 *  - Top-3 podium layout (avatar, handle, car, value)
 *  - Ranks 4+ list rows below
 *  - Pinned "You, #N" bar anchored above tab bar
 *  - Cached last-known leaderboard with "Updated X ago" banner
 *  - Skeleton loading state & pull-to-refresh
 *  - Friendly error handling via toUserMessage() with Retry CTA
 *  - Network reachability diagnostic sheet
 *  - Pure theme tokens + Phosphor icons only
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Segmented';
import { FilterChip } from '@/components/ui/FilterChip';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';

import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useRankings } from '@/hooks/useRankings';
import { formatTimeAgo } from '@/services/rankingsCache';
import { runNetworkDiagnostic, type NetworkDiagnosticResult } from '@/utils/networkDiagnostic';
import type {
  BoardTab,
  ScopeType,
  PeriodType,
  DragDistanceType,
  TopSpeedEntry,
  DragEntry,
  DistanceEntry,
} from '@/services/rankings';

// ─── Constants & Types ────────────────────────────────────────────────────────

const BOARD_TABS = ['Top Speed', 'Drag', 'Distance'] as const;

const PERIODS: { id: PeriodType; label: string }[] = [
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all',   label: 'All' },
];

const SCOPES: { id: ScopeType; label: string }[] = [
  { id: 'global',   label: 'Global' },
  { id: 'same_car', label: 'Same Car' },
];

const DRAG_DISTANCES: { id: DragDistanceType; label: string }[] = [
  { id: 'quarter_mile', label: '¼ mi' },
  { id: 'half_mile',    label: '½ mi' },
  { id: 'mile',         label: '1 mi' },
];

const PODIUM_COLORS = {
  1: { badge: '#FFD700', text: '#FFD700', bg: 'rgba(255,215,0,0.12)' },
  2: { badge: '#C0C0C0', text: '#E2E8F0', bg: 'rgba(192,192,192,0.10)' },
  3: { badge: '#CD7F32', text: '#F59E0B', bg: 'rgba(205,127,50,0.10)' },
} as const;

export interface DisplayEntry {
  rank: number;
  name: string;
  car: string;
  metric: string;
  subMetric?: string;
  isCurrentUser: boolean;
  userId: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatSpeed(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
}

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(3)}s`;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'D';
}

// ─── Avatar Component ─────────────────────────────────────────────────────────

function DriverAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = getInitials(name);
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `hsl(${hue}, 45%, 18%)`,
          borderColor: `hsl(${hue}, 55%, 32%)`,
        },
      ]}
    >
      <Text
        variant="label"
        color={Colors.text.primary}
        style={{ fontSize: size * 0.38, fontWeight: '700' }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ─── Podium Card Component ───────────────────────────────────────────────────

interface PodiumCardProps {
  rank: 1 | 2 | 3;
  name: string;
  car: string;
  metric: string;
  isCurrentUser: boolean;
}

function PodiumCard({ rank, name, car, metric, isCurrentUser }: PodiumCardProps) {
  const colors = PODIUM_COLORS[rank];
  const isFirst = rank === 1;

  return (
    <View
      style={[
        styles.podiumCol,
        isFirst && styles.podiumColFirst,
      ]}
    >
      {/* Trophy icon for 1st place */}
      {isFirst && (
        <View style={styles.crownWrap}>
          <Icon name="trophy" size={20} color={colors.text} weight="fill" />
        </View>
      )}

      {/* Driver Avatar with Rank Badge */}
      <View style={styles.podiumAvatarWrap}>
        <DriverAvatar name={name} size={isFirst ? 52 : 44} />
        <View style={[styles.podiumRankBadge, { backgroundColor: colors.badge }]}>
          <Text variant="label" color="#05070D" style={styles.podiumRankText} tabular>
            {rank}
          </Text>
        </View>
      </View>

      {/* Driver & Car info */}
      <Text
        variant="body"
        color={isCurrentUser ? Colors.accent.cyan : Colors.text.primary}
        style={[styles.podiumName, isFirst && styles.podiumNameFirst]}
        numberOfLines={1}
      >
        {name}
      </Text>

      {car ? (
        <Text variant="overline" color={Colors.text.tertiary} numberOfLines={1} style={styles.podiumCar}>
          {car}
        </Text>
      ) : null}

      {/* Metric value pedestal */}
      <View style={[styles.podiumPedestal, { backgroundColor: colors.bg, borderColor: colors.badge }]}>
        <Text
          variant="label"
          color={colors.text}
          style={[styles.podiumMetric, isFirst && styles.podiumMetricFirst]}
          tabular
        >
          {metric}
        </Text>
      </View>
    </View>
  );
}

// ─── List Row Component ───────────────────────────────────────────────────────

interface LeaderboardRowProps {
  rank: number;
  name: string;
  car: string;
  metric: string;
  subMetric?: string;
  isCurrentUser: boolean;
}

function LeaderboardRow({
  rank,
  name,
  car,
  metric,
  subMetric,
  isCurrentUser,
}: LeaderboardRowProps) {
  return (
    <View style={[styles.row, isCurrentUser && styles.rowCurrent]}>
      {isCurrentUser && <View style={styles.rowAccentBar} />}

      {/* Rank number */}
      <View style={styles.rankCell}>
        <Text variant="label" color={Colors.text.tertiary} style={styles.rankNum} tabular>
          {rank}
        </Text>
      </View>

      {/* Avatar */}
      <DriverAvatar name={name} size={36} />

      {/* Driver + Car */}
      <View style={styles.rowMid}>
        <View style={styles.nameRow}>
          <Text
            variant="label"
            color={isCurrentUser ? Colors.accent.cyan : Colors.text.primary}
            numberOfLines={1}
            style={styles.driverName}
          >
            {name}
          </Text>
          {isCurrentUser && (
            <View style={styles.youTag}>
              <Text variant="overline" color={Colors.accent.cyan} style={styles.youTagText}>
                YOU
              </Text>
            </View>
          )}
        </View>
        {car ? (
          <Text variant="overline" color={Colors.text.tertiary} numberOfLines={1}>
            {car}
          </Text>
        ) : null}
      </View>

      {/* Primary + Sub metric */}
      <View style={styles.statCell}>
        <Text variant="label" color={Colors.text.primary} style={styles.metricText} tabular>
          {metric}
        </Text>
        {subMetric ? (
          <Text variant="overline" color={Colors.text.tertiary} tabular>
            {subMetric}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Pinned "You, #N" Bar ────────────────────────────────────────────────────

interface PinnedRankBarProps {
  rank: number | null;
  metric: string | null;
  carName: string | null;
  loading: boolean;
}

function PinnedRankBar({ rank, metric, carName, loading }: PinnedRankBarProps) {
  return (
    <View style={styles.pinnedBar}>
      <View style={styles.pinnedLeft}>
        <View style={[styles.pinnedRankPill, rank != null && styles.pinnedRankPillActive]}>
          <Text
            variant="label"
            color={rank != null ? Colors.accent.cyan : Colors.text.tertiary}
            style={styles.pinnedRankText}
            tabular
          >
            {loading ? '…' : rank != null ? `#${rank}` : '—'}
          </Text>
        </View>
        <View style={styles.pinnedDetails}>
          <Text variant="label" color={Colors.text.primary} numberOfLines={1}>
            You
          </Text>
          <Text variant="overline" color={Colors.text.tertiary} numberOfLines={1}>
            {carName ?? 'Personal Best'}
          </Text>
        </View>
      </View>

      <View style={styles.pinnedRight}>
        <Text
          variant="label"
          color={metric ? Colors.accent.cyan : Colors.text.tertiary}
          style={styles.pinnedMetric}
          tabular
        >
          {metric ?? 'No record'}
        </Text>
        <Text variant="overline" color={Colors.text.tertiary}>
          {rank != null ? 'Current standing' : 'Unranked'}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen Component ────────────────────────────────────────────────────

export default function RankingsScreen({ isEmbedded = false }: { isEmbedded?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { primaryVehicle } = useVehicles();

  // Filters
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [period, setPeriod] = useState<PeriodType>('all');
  const [scope, setScope] = useState<ScopeType>('global');
  const [dragDistance, setDragDistance] = useState<DragDistanceType>('quarter_mile');

  // Network diagnostic modal state
  const [diagModalOpen, setDiagModalOpen] = useState(false);
  const [diagResult, setDiagResult] = useState<NetworkDiagnosticResult | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);

  const activeTab: BoardTab =
    tabIndex === 0 ? 'top_speed' : tabIndex === 1 ? 'drag' : 'distance';

  const sameCarFilter =
    scope === 'same_car' && primaryVehicle
      ? { make: primaryVehicle.make, model: primaryVehicle.model }
      : undefined;

  const {
    topSpeed,
    drag,
    distance,
    userRank,
    userRankLoading,
    loadUserRank,
  } = useRankings({
    scope,
    period,
    sameCarFilter,
    dragDistanceType: dragDistance,
    currentUserId: user?.id,
  });

  // Current active board state
  const activeBoard =
    activeTab === 'top_speed' ? topSpeed : activeTab === 'drag' ? drag : distance;

  // Sync user rank when tab or filters change
  useEffect(() => {
    loadUserRank(activeTab);
  }, [activeTab, loadUserRank]);

  // Pull-to-refresh
  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    activeBoard.refresh();
    loadUserRank(activeTab);
  }, [activeBoard, loadUserRank, activeTab]);

  // Network diagnostic test
  const handleRunDiagnostic = async () => {
    setDiagRunning(true);
    setDiagModalOpen(true);
    try {
      const result = await runNetworkDiagnostic();
      setDiagResult(result);
    } finally {
      setDiagRunning(false);
    }
  };

  // Convert raw entry to normalized display format
  function getEntryDisplay(item: TopSpeedEntry | DragEntry | DistanceEntry): DisplayEntry {
    const isCurrentUser = item.user_id === user?.id;
    const carParts = [
      'year' in item && item.year ? String(item.year) : '',
      item.make ?? '',
      item.model ?? '',
    ].filter(Boolean);
    const carStr = carParts.join(' ');

    let metricStr = '';
    let subMetricStr: string | undefined = undefined;

    if (activeTab === 'top_speed') {
      metricStr = formatSpeed((item as TopSpeedEntry).top_speed);
    } else if (activeTab === 'drag') {
      const d = item as DragEntry;
      metricStr = formatElapsed(d.elapsed_ms);
      subMetricStr = formatSpeed(d.top_speed);
    } else {
      const dist = item as DistanceEntry;
      metricStr = formatDistance(dist.total_distance_m);
      subMetricStr = `${dist.total_trips} trips`;
    }

    return {
      rank: item.rank,
      name: item.display_name,
      car: carStr,
      metric: metricStr,
      subMetric: subMetricStr,
      isCurrentUser,
      userId: item.user_id,
    };
  }

  // Derive own metric for pinned bar
  const myMetricDisplay = ((): string | null => {
    if (!userRank) return null;
    if (activeTab === 'top_speed') return formatSpeed(userRank.value);
    if (activeTab === 'drag') return formatElapsed(userRank.value);
    return formatDistance(userRank.value);
  })();

  const myCarDisplay = primaryVehicle
    ? `${primaryVehicle.make} ${primaryVehicle.model}`
    : null;

  // Normalized display items
  const allDisplayItems: DisplayEntry[] = activeBoard.data.map(getEntryDisplay);
  const podiumDisplay = allDisplayItems.slice(0, 3);
  const remainingRows = allDisplayItems.slice(3);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <ScreenContainer
        title="Rankings"
        scrollable={false}
        skipTopInset={isEmbedded}
        headerRight={
          <Pressable
            onPress={handleRunDiagnostic}
            style={styles.diagHeaderBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Network diagnostic check"
          >
            <Icon
              name="wifi"
              size={18}
              color={activeBoard.error ? Colors.semantic.danger : Colors.text.tertiary}
              weight="regular"
            />
          </Pressable>
        }
      >
        <View style={styles.container}>
          {/* ── Tabs (Top Speed · Drag · Distance) ───────────────────────── */}
          <View style={styles.tabSection}>
            <Segmented
              options={[...BOARD_TABS]}
              selected={tabIndex}
              onChange={setTabIndex}
            />
          </View>

          {/* ── Filter row: Period + Scope + Drag distance ────────────────── */}
          <View style={styles.filterSection}>
            {/* Period chips */}
            <View style={styles.chipRow}>
              {PERIODS.map((p) => (
                <FilterChip
                  key={p.id}
                  label={p.label}
                  active={period === p.id}
                  onPress={() => setPeriod(p.id)}
                />
              ))}

              <View style={styles.filterDivider} />

              {/* Scope chips */}
              {SCOPES.map((s) => (
                <FilterChip
                  key={s.id}
                  label={s.label}
                  active={scope === s.id}
                  onPress={() => setScope(s.id)}
                />
              ))}
            </View>

            {/* Drag sub-filter (only visible on Drag tab) */}
            {activeTab === 'drag' && (
              <View style={[styles.chipRow, styles.dragSubRow]}>
                {DRAG_DISTANCES.map((d) => (
                  <FilterChip
                    key={d.id}
                    label={d.label}
                    active={dragDistance === d.id}
                    onPress={() => setDragDistance(d.id)}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ── Offline Cached Banner ────────────────────────────────────── */}
          {activeBoard.fromCache && (
            <View style={styles.cachedBanner}>
              <Icon name="wifi-off" size={14} color={Colors.semantic.warning} weight="bold" />
              <Text variant="overline" color={Colors.semantic.warning} style={styles.cachedBannerText}>
                {activeBoard.cachedAt
                  ? `Offline cache · Updated ${formatTimeAgo(activeBoard.cachedAt)}`
                  : 'Offline cache · Showing last known data'}
              </Text>
            </View>
          )}

          {/* ── Board Content ────────────────────────────────────────────── */}
          <View style={styles.listContainer}>
            {activeBoard.loading && activeBoard.data.length === 0 ? (
              <View style={styles.skeletonList}>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </View>
            ) : activeBoard.error && activeBoard.data.length === 0 ? (
              <ErrorState
                message={activeBoard.error}
                onRetry={activeBoard.refresh}
              />
            ) : activeBoard.data.length === 0 ? (
              <EmptyState
                icon="trophy"
                iconColor="cyan"
                title="No entries yet"
                description="Set the benchmark by completing a recorded run."
                action={{
                  label: 'Start Drive',
                  onPress: () => router.push('/(tabs)/track'),
                }}
              />
            ) : (
              <FlatList<DisplayEntry>
                data={remainingRows}
                keyExtractor={(item) => `${item.userId}-${item.rank}`}
                renderItem={({ item }) => (
                  <LeaderboardRow
                    rank={item.rank}
                    name={item.name}
                    car={item.car}
                    metric={item.metric}
                    subMetric={item.subMetric}
                    isCurrentUser={item.isCurrentUser}
                  />
                )}
                ListHeaderComponent={
                  podiumDisplay.length > 0 ? (
                    <View style={styles.podiumContainer}>
                      {/* 2nd place (left) */}
                      {podiumDisplay[1] ? (
                        <PodiumCard
                          rank={2}
                          name={podiumDisplay[1].name}
                          car={podiumDisplay[1].car}
                          metric={podiumDisplay[1].metric}
                          isCurrentUser={podiumDisplay[1].isCurrentUser}
                        />
                      ) : (
                        <View style={styles.podiumPlaceholder} />
                      )}

                      {/* 1st place (center, elevated) */}
                      {podiumDisplay[0] ? (
                        <PodiumCard
                          rank={1}
                          name={podiumDisplay[0].name}
                          car={podiumDisplay[0].car}
                          metric={podiumDisplay[0].metric}
                          isCurrentUser={podiumDisplay[0].isCurrentUser}
                        />
                      ) : null}

                      {/* 3rd place (right) */}
                      {podiumDisplay[2] ? (
                        <PodiumCard
                          rank={3}
                          name={podiumDisplay[2].name}
                          car={podiumDisplay[2].car}
                          metric={podiumDisplay[2].metric}
                          isCurrentUser={podiumDisplay[2].isCurrentUser}
                        />
                      ) : (
                        <View style={styles.podiumPlaceholder} />
                      )}
                    </View>
                  ) : null
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.flatListContent,
                  { paddingBottom: insets.bottom + 84 }, // clears pinned bar
                ]}
                refreshControl={
                  <RefreshControl
                    refreshing={activeBoard.loading && activeBoard.data.length > 0}
                    onRefresh={handleRefresh}
                    tintColor={Colors.accent.cyan}
                    colors={[Colors.accent.cyan]}
                  />
                }
              />
            )}
          </View>

          {/* ── Pinned "You, #N" Bar (Sticky bottom) ──────────────────────── */}
          <PinnedRankBar
            rank={userRank?.rank ?? null}
            metric={myMetricDisplay}
            carName={myCarDisplay}
            loading={userRankLoading}
          />
        </View>
      </ScreenContainer>

      {/* ── Network Diagnostic Modal ────────────────────────────────────── */}
      <Modal
        visible={diagModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDiagModalOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDiagModalOpen(false)}
        />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing[4] }]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Icon name="gauge" size={20} color={Colors.accent.cyan} weight="bold" />
            <Text variant="heading">Network & Server Diagnostic</Text>
          </View>

          {diagRunning ? (
            <View style={styles.modalRunning}>
              <Text variant="body" color={Colors.text.secondary}>
                Probing connection and Supabase endpoints…
              </Text>
            </View>
          ) : diagResult ? (
            <View style={styles.diagResults}>
              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Network Status</Text>
                <Text
                  variant="label"
                  color={diagResult.isConnected ? Colors.semantic.success : Colors.semantic.danger}
                >
                  {diagResult.isConnected ? 'Connected' : 'Disconnected'}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Internet Reachable</Text>
                <Text
                  variant="label"
                  color={diagResult.isInternetReachable ? Colors.semantic.success : Colors.semantic.warning}
                >
                  {diagResult.isInternetReachable === true
                    ? 'Yes'
                    : diagResult.isInternetReachable === false
                    ? 'No route'
                    : 'Checking'}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Supabase Host</Text>
                <Text variant="overline" color={Colors.text.secondary} numberOfLines={1}>
                  {diagResult.supabaseHost}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text variant="label" color={Colors.text.tertiary}>Host Reachable</Text>
                <Text
                  variant="label"
                  color={diagResult.canReachSupabase ? Colors.semantic.success : Colors.semantic.danger}
                >
                  {diagResult.canReachSupabase
                    ? `Reachable (${diagResult.latencyMs} ms)`
                    : 'Unreachable (UnknownHost)'}
                </Text>
              </View>

              {diagResult.errorDetail && (
                <View style={styles.diagErrorBox}>
                  <Text variant="overline" color={Colors.semantic.danger}>
                    {diagResult.errorDetail}
                  </Text>
                </View>
              )}

              <View style={styles.dashboardChecklist}>
                <Text variant="label" color={Colors.text.primary} style={{ fontWeight: '700' }}>
                  Supabase Dashboard Checklist:
                </Text>
                <Text variant="overline" color={Colors.text.secondary}>
                  1. Check Project Status: Settings → General (Must be &quot;Active&quot;).
                </Text>
                <Text variant="overline" color={Colors.text.secondary}>
                  2. Verify Project Ref matches: {diagResult.supabaseHost.split('.')[0]}.
                </Text>
                <Text variant="overline" color={Colors.text.secondary}>
                  3. If project was paused, click &quot;Restore Project&quot; in dashboard.
                </Text>
              </View>
            </View>
          ) : null}

          <Button
            variant="primary"
            onPress={() => setDiagModalOpen(false)}
            style={styles.modalCloseBtn}
          >
            Done
          </Button>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  diagHeaderBtn: {
    padding: Spacing[2],
  },

  // Tabs
  tabSection: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[2],
    paddingBottom: Spacing[3],
  },

  // Filters
  filterSection: {
    paddingHorizontal: Spacing.screen,
    gap: Spacing[2],
    paddingBottom: Spacing[3],
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    flexWrap: 'wrap',
  },
  dragSubRow: {
    paddingTop: 2,
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.hairline,
    marginHorizontal: 4,
  },

  // Cached banner
  cachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginHorizontal: Spacing.screen,
    marginBottom: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
  },
  cachedBannerText: {
    fontWeight: '600',
  },

  // List & Podium
  listContainer: {
    flex: 1,
  },
  flatListContent: {
    paddingHorizontal: Spacing.screen,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  podiumColFirst: {
    transform: [{ translateY: -10 }],
  },
  podiumPlaceholder: {
    flex: 1,
  },
  crownWrap: {
    marginBottom: -4,
  },
  podiumAvatarWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  podiumRankBadge: {
    position: 'absolute',
    bottom: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bg.base,
  },
  podiumRankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  podiumName: {
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 100,
  },
  podiumNameFirst: {
    fontSize: 14,
    fontWeight: '700',
  },
  podiumCar: {
    fontSize: 10,
    textAlign: 'center',
    maxWidth: 100,
    marginTop: -4,
  },
  podiumPedestal: {
    width: '100%',
    paddingVertical: Spacing[2],
    borderRadius: Radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  podiumMetric: {
    fontWeight: '700',
    fontSize: 13,
  },
  podiumMetricFirst: {
    fontSize: 15,
  },

  // List Rows (ranks 4+)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
    gap: Spacing[3],
    position: 'relative',
  },
  rowCurrent: {
    backgroundColor: 'rgba(34,211,238,0.04)',
  },
  rowAccentBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    backgroundColor: Colors.accent.cyan,
    borderRadius: Radius.pill,
  },
  rankCell: {
    width: 24,
    alignItems: 'center',
  },
  rankNum: {
    fontWeight: '700',
    fontSize: 13,
  },
  rowMid: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  driverName: {
    fontWeight: '600',
    maxWidth: 160,
  },
  youTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.30)',
  },
  youTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statCell: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metricText: {
    fontWeight: '700',
    fontSize: 14,
  },

  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Skeletons
  skeletonList: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[4],
    gap: Spacing[3],
  },

  // Pinned Bottom Bar
  pinnedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface['2'],
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: 12,
  },
  pinnedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  pinnedRankPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  pinnedRankPillActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: Colors.accent.cyan,
  },
  pinnedRankText: {
    fontWeight: '800',
    fontSize: 13,
  },
  pinnedDetails: {
    gap: 2,
  },
  pinnedRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  pinnedMetric: {
    fontWeight: '700',
    fontSize: 15,
  },

  // Diagnostic Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface['2'],
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    gap: Spacing[4],
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.hairline,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  modalRunning: {
    paddingVertical: Spacing[4],
    alignItems: 'center',
  },
  diagResults: {
    gap: Spacing[3],
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  diagErrorBox: {
    padding: Spacing[3],
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(244,63,94,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244,63,94,0.20)',
  },
  dashboardChecklist: {
    padding: Spacing[3],
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    gap: 4,
    marginTop: 4,
  },
  modalCloseBtn: {
    marginTop: Spacing[2],
  },
});
