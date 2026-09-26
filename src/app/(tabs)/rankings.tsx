/**
 * RankingsScreen
 *
 * Three tabs: Top Speed · Drag Times · Distance
 * Two scopes: Global · Same Car (requires a primary vehicle)
 * Drag sub-filter: ¼ · ½ · Mile
 *
 * Visual direction: dark cockpit feel. Rank badge uses a gradient fill for
 * the podium positions (1–3). Each row animates in with a staggered fade-up
 * on first load. Current user's row is highlighted with an accent rail.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Duration, FontFamily, FontSize, LineHeight, Radius, Spacing } from '@/constants/design';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useRankings, type UseRankingsParams } from '@/hooks/useRankings';
import type {
  DragDistanceType,
  ScopeType,
  SameCarFilter,
  TopSpeedEntry,
  DragEntry,
  DistanceEntry,
} from '@/services/rankings';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserVehicles } from '@/services/vehicles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSpeed(kmh: number): string {
  return `${Math.round(kmh)} km/h`;
}

function formatElapsed(ms: number): string {
  const s = ms / 1000;
  return `${s.toFixed(3)}s`;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const PODIUM_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

// ---------------------------------------------------------------------------
// Tab / scope / distance config
// ---------------------------------------------------------------------------

type BoardTab = 'top_speed' | 'drag' | 'distance';

const TABS: { id: BoardTab; label: string }[] = [
  { id: 'top_speed', label: 'Top Speed' },
  { id: 'drag', label: 'Drag Times' },
  { id: 'distance', label: 'Distance' },
];

const SCOPES: { id: ScopeType; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'same_car', label: 'Same Car' },
];

const DRAG_DISTANCES: { id: DragDistanceType; label: string }[] = [
  { id: 'quarter_mile', label: '¼ mi' },
  { id: 'half_mile', label: '½ mi' },
  { id: 'mile', label: '1 mi' },
];

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
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
          backgroundColor: `hsl(${hue}, 55%, 22%)`,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rank Badge
// ---------------------------------------------------------------------------

function RankBadge({ rank }: { rank: number }) {
  const isPodium = rank <= 3;
  const color = PODIUM_COLORS[rank] ?? Colors.textMuted;
  return (
    <View style={[styles.rankBadge, isPodium && { borderColor: color }]}>
      <Text style={[styles.rankText, { color }]}>{rank}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Animated row wrapper — staggered fade + slide up on first mount
// ---------------------------------------------------------------------------

function AnimatedRow({ index, children }: { index: number; children: React.ReactNode }) {
  // useState gives a stable reference that satisfies react-hooks/refs (same as Skeleton pattern).
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: Duration.reveal,
      delay: Math.min(index * 40, 400),
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const opacity = anim;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function TopSpeedRow({
  entry,
  index,
  isCurrentUser,
}: {
  entry: TopSpeedEntry;
  index: number;
  isCurrentUser: boolean;
}) {
  return (
    <AnimatedRow index={index}>
      <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
        {isCurrentUser && <View style={styles.rowAccentRail} />}
        <RankBadge rank={entry.rank} />
        <Avatar name={entry.display_name} />
        <View style={styles.rowMid}>
          <Text style={styles.rowName} numberOfLines={1}>
            {entry.display_name}
          </Text>
          {(entry.make || entry.model) && (
            <Text style={styles.rowSub} numberOfLines={1}>
              {[entry.year, entry.make, entry.model].filter(Boolean).join(' ')}
            </Text>
          )}
        </View>
        <View style={styles.rowStat}>
          <Text style={[styles.rowStatValue, { color: Colors.accentCyan }]}>
            {formatSpeed(entry.top_speed)}
          </Text>
        </View>
      </View>
    </AnimatedRow>
  );
}

function DragRow({
  entry,
  index,
  isCurrentUser,
}: {
  entry: DragEntry;
  index: number;
  isCurrentUser: boolean;
}) {
  return (
    <AnimatedRow index={index}>
      <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
        {isCurrentUser && <View style={styles.rowAccentRail} />}
        <RankBadge rank={entry.rank} />
        <Avatar name={entry.display_name} />
        <View style={styles.rowMid}>
          <Text style={styles.rowName} numberOfLines={1}>
            {entry.display_name}
          </Text>
          {(entry.make || entry.model) && (
            <Text style={styles.rowSub} numberOfLines={1}>
              {[entry.year, entry.make, entry.model].filter(Boolean).join(' ')}
            </Text>
          )}
        </View>
        <View style={styles.rowStat}>
          <Text style={[styles.rowStatValue, { color: Colors.accentOrange }]}>
            {formatElapsed(entry.elapsed_ms)}
          </Text>
          <Text style={styles.rowStatSub}>{formatSpeed(entry.top_speed)}</Text>
        </View>
      </View>
    </AnimatedRow>
  );
}

function DistanceRow({
  entry,
  index,
  isCurrentUser,
}: {
  entry: DistanceEntry;
  index: number;
  isCurrentUser: boolean;
}) {
  return (
    <AnimatedRow index={index}>
      <View style={[styles.row, isCurrentUser && styles.rowHighlight]}>
        {isCurrentUser && <View style={styles.rowAccentRail} />}
        <RankBadge rank={entry.rank} />
        <Avatar name={entry.display_name} />
        <View style={styles.rowMid}>
          <Text style={styles.rowName} numberOfLines={1}>
            {entry.display_name}
          </Text>
          <Text style={styles.rowSub}>{entry.total_trips} trips</Text>
        </View>
        <View style={styles.rowStat}>
          <Text style={[styles.rowStatValue, { color: Colors.accentGreen }]}>
            {formatDistance(entry.total_distance_m)}
          </Text>
        </View>
      </View>
    </AnimatedRow>
  );
}

// ---------------------------------------------------------------------------
// Skeleton list
// ---------------------------------------------------------------------------

function LeaderboardSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.centeredState}>
      <Text style={styles.emptyIcon}>🏁</Text>
      <Text style={styles.emptyTitle}>No entries yet</Text>
      <Text style={styles.emptyBody}>{message}</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centeredState}>
      <Text style={styles.emptyIcon}>⚠️</Text>
      <Text style={styles.emptyTitle}>Couldn&apos;t load leaderboard</Text>
      <Text style={styles.emptyBody}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry loading leaderboard">
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pill selector
// ---------------------------------------------------------------------------

function PillSelector<T extends string>({
  options,
  selected,
  onSelect,
  accentColor = Colors.accentCyan,
}: {
  options: { id: T; label: string }[];
  selected: T;
  onSelect: (id: T) => void;
  accentColor?: string;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((opt) => {
        const isActive = opt.id === selected;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onSelect(opt.id)}
            style={[styles.pill, isActive && { backgroundColor: accentColor + '22', borderColor: accentColor }]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.pillText, isActive && { color: accentColor }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function RankingsScreen() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<BoardTab>('top_speed');
  const [scope, setScope] = useState<ScopeType>('global');
  const [dragDistance, setDragDistance] = useState<DragDistanceType>('quarter_mile');
  const [primaryVehicle, setPrimaryVehicle] = useState<SameCarFilter | undefined>(undefined);

  // Fetch the user's primary vehicle once so we can apply the same-car scope filter.
  useEffect(() => {
    if (!user?.id) return;
    fetchUserVehicles(user.id)
      .then((vehicles) => {
        const primary = vehicles.find((v) => v.is_primary) ?? vehicles[0];
        if (primary) setPrimaryVehicle({ make: primary.make, model: primary.model });
      })
      .catch(() => {
        // Non-critical — same_car scope will fall back to global if unavailable
      });
  }, [user?.id]);

  const sameCarFilter: SameCarFilter | undefined =
    scope === 'same_car' ? primaryVehicle : undefined;

  const params: UseRankingsParams = {
    scope,
    sameCarFilter,
    dragDistanceType: dragDistance,
  };

  const { topSpeed, drag, distance } = useRankings(params);

  // Derive active board state for RefreshControl
  const activeBoard = activeTab === 'top_speed' ? topSpeed : activeTab === 'drag' ? drag : distance;
  const isRefreshing = activeBoard.loading && activeBoard.data.length > 0;

  const onRefresh = useCallback(() => {
    topSpeed.refresh();
    drag.refresh();
    distance.refresh();
  }, [topSpeed, drag, distance]);

  // Tab indicator slide animation
  // useState gives a stable reference compatible with react-hooks/refs lint rule.
  const [tabIndicatorAnim] = useState(() => new Animated.Value(0));
  const tabIndex = TABS.findIndex((t) => t.id === activeTab);
  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      useNativeDriver: true,
      tension: 180,
      friction: 20,
    }).start();
  }, [tabIndex, tabIndicatorAnim]);

  // ---------------------------------------------------------------------------
  // Board renderers
  // ---------------------------------------------------------------------------

  function renderTopSpeed() {
    if (topSpeed.loading && topSpeed.data.length === 0) return <LeaderboardSkeleton />;
    if (topSpeed.error) return <ErrorState message={topSpeed.error} onRetry={topSpeed.refresh} />;
    if (topSpeed.data.length === 0) return <EmptyState message="Be the first to record a top speed run." />;
    return (
      <FlatList
        data={topSpeed.data}
        keyExtractor={(item) => `${item.user_id}-${item.recorded_at}`}
        renderItem={({ item, index }) => (
          <TopSpeedRow entry={item} index={index} isCurrentUser={item.user_id === user?.id} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    );
  }

  function renderDrag() {
    if (drag.loading && drag.data.length === 0) return <LeaderboardSkeleton />;
    if (drag.error) return <ErrorState message={drag.error} onRetry={drag.refresh} />;
    if (drag.data.length === 0) return <EmptyState message="No drag runs recorded yet. Start a drag race to appear here." />;
    return (
      <FlatList
        data={drag.data}
        keyExtractor={(item) => `${item.user_id}-${item.recorded_at}`}
        renderItem={({ item, index }) => (
          <DragRow entry={item} index={index} isCurrentUser={item.user_id === user?.id} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    );
  }

  function renderDistance() {
    if (distance.loading && distance.data.length === 0) return <LeaderboardSkeleton />;
    if (distance.error) return <ErrorState message={distance.error} onRetry={distance.refresh} />;
    if (distance.data.length === 0) return <EmptyState message="Complete trips to appear on the distance board." />;
    return (
      <FlatList
        data={distance.data}
        keyExtractor={(item) => item.user_id}
        renderItem={({ item, index }) => (
          <DistanceRow entry={item} index={index} isCurrentUser={item.user_id === user?.id} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Rankings</Text>
          <Text style={styles.headerSub}>Community Leaderboard</Text>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        {TABS.map((tab, i) => {
          const isActive = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {/* Sliding underline indicator */}
        {/* Indicator is sized to 1/3rd of the row; translateX shifts it to the active slot. */}
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              transform: [
                {
                  // Each slot is 1/3 of the bar width; use a layout-relative approach:
                  // The indicator width is set to `${100/TABS.length}%` so slot 0 starts
                  // at 0, slot 1 at 100%, slot 2 at 200% of the indicator's own width.
                  // We approximate with a large constant (device width ≈ 400px -> 133px/slot)
                  // and rely on the width % to keep it aligned across screen sizes.
                  translateX: tabIndicatorAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [0, 133, 266],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accentCyan}
            colors={[Colors.accentCyan]}
          />
        }
      >
        {/* ── Scope Selector ── */}
        <View style={styles.controlRow}>
          <PillSelector
            options={SCOPES}
            selected={scope}
            onSelect={setScope}
            accentColor={Colors.accentCyan}
          />

          {/* Drag distance sub-filter — only on drag tab */}
          {activeTab === 'drag' && (
            <PillSelector
              options={DRAG_DISTANCES}
              selected={dragDistance}
              onSelect={setDragDistance}
              accentColor={Colors.accentOrange}
            />
          )}
        </View>

        {/* Same-car hint */}
        {scope === 'same_car' && (
          <View style={styles.sameCarNote}>
            <Text style={styles.sameCarNoteText}>
              Showing results for your primary vehicle&apos;s make &amp; model.
            </Text>
          </View>
        )}

        {/* ── Board content ── */}
        <View style={styles.board}>
          {activeTab === 'top_speed' && renderTopSpeed()}
          {activeTab === 'drag' && renderDrag()}
          {activeTab === 'distance' && renderDistance()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.base,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    lineHeight: LineHeight.h1,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    position: 'relative',
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.semiBold,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    // Width is 1/3rd of the bar, positioned by translateX
    width: `${100 / TABS.length}%`,
    height: 2,
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.full,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
  },

  // Controls
  controlRow: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    gap: Spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  pillText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },

  // Same-car note
  sameCarNote: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: Colors.accentCyanDim,
    borderRadius: Radius.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accentCyan,
  },
  sameCarNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },

  // Board
  board: {
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  listContent: {
    gap: 0,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  rowHighlight: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.accentCyan + '40',
  },
  rowAccentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.accentCyan,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
  },
  rowMid: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  rowSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  rowStat: {
    alignItems: 'flex-end',
    gap: 2,
  },
  rowStatValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
  },
  rowStatSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },

  // Rank badge
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
  },

  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },

  // Skeleton
  skeletonList: {
    gap: Spacing.sm,
  },

  // Empty / error
  centeredState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  emptyBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: LineHeight.label,
  },
  retryBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textPrimary,
  },
});
