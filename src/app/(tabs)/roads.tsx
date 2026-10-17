/**
 * RoadsScreen — Slipstream Favorite & Community Roads Explorer
 *
 * Phase 4 Architecture:
 *  - Large title "Roads" collapsing on scroll inside ScreenContainer
 *  - Segmented control: Nearby and Mine
 *  - Search input with clear button
 *  - Filter chips: Twisty, Scenic, Off-road, Tarmac, Distance (sort)
 *  - Radius selector for Nearby query: 25 km, 50 km, 100 km, 250 km
 *  - RoadCard with SVG route thumbnail, telemetry metrics, and bookmarking
 *  - Two distinct empty states (Nearby vs Mine) that never cross-display
 *  - Skeleton cards during load, ErrorState with toUserMessage() on failure
 *  - Reporting modal & Share recap integration
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { type ErrorBoundaryProps, useRouter } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error/RouteErrorBoundary';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Segmented } from '@/components/ui/Segmented';
import { FilterChip } from '@/components/ui/FilterChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { RoadCard } from '@/components/roads/RoadCard';
import { RoadCardSkeleton } from '@/components/roads/RoadCardSkeleton';
import { RoadReportModal } from '@/components/roads/RoadReportModal';
import { ShareRecapModal } from '@/components/recap/ShareRecapModal';
import { useTracking } from '@/contexts/TrackingContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNearbyRoads,
  fetchMyRoads,
  deleteRoad,
  type SavedRoad,
} from '@/services/savedRoads';
import { type GenerateRecapCardParams } from '@/services/shareCard';
import { toUserMessage } from '@/utils/toUserMessage';

type FilterTag = 'all' | 'twisty' | 'scenic' | 'off_road' | 'tarmac' | 'distance';
const RADIUS_OPTIONS = [25, 50, 100, 250] as const;

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <RouteErrorBoundary {...props} screenTitle="Roads" />;
}

export default function RoadsScreen() {
  const router = useRouter();
  const { currentCoords } = useTracking();
  const { user } = useAuth();

  const [tabIndex, setTabIndex] = useState<number>(0); // 0 = Nearby, 1 = Mine
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number>(100);
  const [activeFilter, setActiveFilter] = useState<FilterTag>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [nearbyRoads, setNearbyRoads] = useState<SavedRoad[]>([]);
  const [myRoads, setMyRoads] = useState<SavedRoad[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [reportingRoad, setReportingRoad] = useState<SavedRoad | null>(null);
  const [shareParams, setShareParams] = useState<GenerateRecapCardParams | null>(null);

  const currentLon = currentCoords?.[0] ?? null;
  const currentLat = currentCoords?.[1] ?? null;

  const loadData = useCallback(async () => {
    try {
      if (tabIndex === 0) {
        // Nearby Tab
        if (currentLon !== null && currentLat !== null) {
          const radiusMeters = selectedRadiusKm * 1000;
          const tag = activeFilter !== 'distance' && activeFilter !== 'all' ? activeFilter : undefined;
          const roads = await fetchNearbyRoads(currentLon, currentLat, radiusMeters, tag);
          setNearbyRoads(roads);
          setErrorMsg(null);
        } else {
          setNearbyRoads([]);
          setErrorMsg(null);
        }
      } else {
        // Mine Tab
        const roads = await fetchMyRoads();
        setMyRoads(roads);
        setErrorMsg(null);
      }
    } catch (err) {
      const msg = toUserMessage(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tabIndex, currentLon, currentLat, selectedRadiusKm, activeFilter]);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (!isCancelled) {
        await loadData();
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const handleDeleteRoad = async (road: SavedRoad) => {
    try {
      await deleteRoad(road.id);
      setMyRoads((prev) => prev.filter((r) => r.id !== road.id));
      setNearbyRoads((prev) => prev.filter((r) => r.id !== road.id));
      Alert.alert('Road Deleted', `"${road.name}" has been removed.`);
    } catch (err) {
      const msg = toUserMessage(err);
      Alert.alert('Delete Failed', msg);
    }
  };

  const handleShareRoad = (road: SavedRoad) => {
    setShareParams({
      type: 'trip',
      headline: road.name.toUpperCase(),
      distanceMeters: road.lengthMeters,
      topSpeedKmh: road.bestAvgSpeedKmh ? road.bestAvgSpeedKmh * 1.3 : 110,
      durationSeconds: Math.round((road.lengthMeters / ((road.bestAvgSpeedKmh || 60) * (1000 / 3600)))),
    });
  };

  // Filter & Search computation
  const activeRoadsList = tabIndex === 0 ? nearbyRoads : myRoads;

  const displayedRoads = useMemo(() => {
    let result = [...activeRoadsList];

    // Search query filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (r.surfaceType && r.surfaceType.toLowerCase().includes(q)),
      );
    }

    // Tag filter
    if (activeFilter === 'twisty') {
      result = result.filter((r) => (r.curvinessScore ?? 0) >= 7.5 || r.tags?.includes('twisty'));
    } else if (activeFilter === 'scenic') {
      result = result.filter((r) => r.tags?.includes('scenic'));
    } else if (activeFilter === 'off_road') {
      result = result.filter((r) => r.surfaceType === 'off_road' || r.tags?.includes('off_road'));
    } else if (activeFilter === 'tarmac') {
      result = result.filter((r) => r.surfaceType === 'tarmac' || !r.surfaceType);
    } else if (activeFilter === 'distance') {
      // Sort by length descending
      result.sort((a, b) => b.lengthMeters - a.lengthMeters);
    }

    return result;
  }, [activeRoadsList, searchQuery, activeFilter]);

  return (
    <ScreenContainer
      scrollable
      title="Roads"
      largeTitle
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.cyan}
          />
        ),
      }}
    >
      <View style={styles.container}>
        {/* Segmented Control: Nearby vs Mine */}
        <View style={styles.segmentedWrapper}>
          <Segmented
            options={['Nearby', 'Mine']}
            selected={tabIndex}
            onChange={(idx) => {
              setLoading(true);
              setTabIndex(idx);
            }}
          />
        </View>

        {/* Search input with Phosphor search icon */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color={Colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search roads, passes, canyons..."
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearBtn}
              hitSlop={8}
            >
              <Icon name="close" size={14} color={Colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Horizontal Filter Chips */}
        <View style={styles.filtersScroll}>
          <FilterChip
            label="All"
            active={activeFilter === 'all'}
            onPress={() => {
              setLoading(true);
              setActiveFilter('all');
            }}
          />
          <FilterChip
            label="Twisty"
            active={activeFilter === 'twisty'}
            onPress={() => {
              setLoading(true);
              setActiveFilter(activeFilter === 'twisty' ? 'all' : 'twisty');
            }}
          />
          <FilterChip
            label="Scenic"
            active={activeFilter === 'scenic'}
            onPress={() => {
              setLoading(true);
              setActiveFilter(activeFilter === 'scenic' ? 'all' : 'scenic');
            }}
          />
          <FilterChip
            label="Tarmac"
            active={activeFilter === 'tarmac'}
            onPress={() => {
              setLoading(true);
              setActiveFilter(activeFilter === 'tarmac' ? 'all' : 'tarmac');
            }}
          />
          <FilterChip
            label="Off-road"
            active={activeFilter === 'off_road'}
            onPress={() => {
              setLoading(true);
              setActiveFilter(activeFilter === 'off_road' ? 'all' : 'off_road');
            }}
          />
          <FilterChip
            label="Distance"
            active={activeFilter === 'distance'}
            onPress={() => {
              setLoading(true);
              setActiveFilter(activeFilter === 'distance' ? 'all' : 'distance');
            }}
          />
        </View>

        {/* Nearby Radius Selector (25, 50, 100, 250 km) */}
        {tabIndex === 0 && (
          <View style={styles.radiusRow}>
            <View style={styles.radiusLabelWrap}>
              <Icon name="map-pin" size={13} color={Colors.accent.cyan} weight="duotone" />
              <Text style={styles.radiusLabel}>RADIUS</Text>
            </View>
            <View style={styles.radiusOptions}>
              {RADIUS_OPTIONS.map((km) => {
                const active = selectedRadiusKm === km;
                return (
                  <TouchableOpacity
                    key={km}
                    style={[styles.radiusChip, active ? styles.radiusChipActive : undefined]}
                    onPress={() => {
                      setLoading(true);
                      setSelectedRadiusKm(km);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.radiusText, active ? styles.radiusTextActive : undefined]}>
                      {km} km
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Content State: Loading */}
        {loading && !refreshing ? (
          <View style={styles.listContainer}>
            <RoadCardSkeleton />
            <RoadCardSkeleton />
            <RoadCardSkeleton />
          </View>
        ) : errorMsg ? (
          /* Content State: Error with Retry */
          <ErrorState message={errorMsg} onRetry={loadData} style={styles.stateContainer} />
        ) : displayedRoads.length === 0 ? (
          /* Content State: Two Distinct Empty States */
          tabIndex === 0 ? (
            /* Nearby Empty State */
            <EmptyState
              icon="path"
              iconColor="cyan"
              title="No roads nearby"
              description={`Nobody has mapped a road within ${selectedRadiusKm} km yet.`}
              action={{
                label: 'Record the first one',
                onPress: () => router.push('/(tabs)/track'),
              }}
              style={styles.stateContainer}
            />
          ) : (
            /* Mine Empty State */
            <EmptyState
              icon="bookmark"
              iconColor="blue"
              title="No saved roads"
              description="You have not saved any roads."
              action={{
                label: 'Browse nearby',
                onPress: () => setTabIndex(0),
              }}
              style={styles.stateContainer}
            />
          )
        ) : (
          /* Content State: Roads List */
          <View style={styles.listContainer}>
            {displayedRoads.map((road) => (
              <RoadCard
                key={road.id}
                road={road}
                isOwner={road.userId === user?.id}
                onShare={handleShareRoad}
                onReport={(r) => setReportingRoad(r)}
                onDelete={handleDeleteRoad}
              />
            ))}
          </View>
        )}
      </View>

      {/* Report Modal */}
      <RoadReportModal
        visible={!!reportingRoad}
        road={reportingRoad}
        onClose={() => setReportingRoad(null)}
      />

      {/* Share Modal */}
      <ShareRecapModal
        visible={!!shareParams}
        params={shareParams}
        onClose={() => setShareParams(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.section,
    gap: Spacing[4],
  },
  segmentedWrapper: {
    marginBottom: Spacing[2],
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface[1],
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingHorizontal: Spacing[3],
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.text.primary,
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  filtersScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface[1],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  radiusLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radiusLabel: {
    fontFamily: FontFamily.overline,
    fontSize: 9,
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
  },
  radiusOptions: {
    flexDirection: 'row',
    gap: 6,
  },
  radiusChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface[2],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  radiusChipActive: {
    borderColor: Colors.accent.cyan,
    backgroundColor: Colors.tint.cyan,
  },
  radiusText: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  radiusTextActive: {
    color: Colors.accent.cyan,
  },
  listContainer: {
    marginTop: Spacing[2],
  },
  stateContainer: {
    marginTop: Spacing.section,
  },
});
