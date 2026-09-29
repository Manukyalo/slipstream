import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontFamily, FontSize, Spacing, Radius } from '@/constants/design';
import { useTracking } from '@/contexts/TrackingContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchNearbyRoads,
  fetchMyRoads,
  deleteRoad,
  toggleRoadVisibility,
  formatRoadLength,
  formatProximity,
  type SavedRoad,
} from '@/services/savedRoads';

type RoadsTab = 'nearby' | 'my_roads';

export default function RoadsScreen() {
  const router = useRouter();
  const { currentCoords } = useTracking();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<RoadsTab>('nearby');
  const [nearbyRoads, setNearbyRoads] = useState<SavedRoad[]>([]);
  const [myRoads, setMyRoads] = useState<SavedRoad[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoad, setSelectedRoad] = useState<SavedRoad | null>(null);

  const currentLon = currentCoords?.[0] ?? null;
  const currentLat = currentCoords?.[1] ?? null;

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        if (activeTab === 'nearby') {
          if (currentLon !== null && currentLat !== null) {
            const roads = await fetchNearbyRoads(currentLon, currentLat);
            if (!cancelled) setNearbyRoads(roads);
          } else {
            if (!cancelled) setNearbyRoads([]);
          }
        } else {
          const roads = await fetchMyRoads();
          if (!cancelled) setMyRoads(roads);
        }
      } catch (err) {
        console.warn('[roads] Error loading roads:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeTab, currentLon, currentLat, refreshKey]);

  const loadData = useCallback(() => { setRefreshKey((k) => k + 1); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleDeleteRoad = async (road: SavedRoad) => {
    Alert.alert(
      'Delete Road',
      `Are you sure you want to delete "${road.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoad(road.id);
              setMyRoads((prev) => prev.filter((r) => r.id !== road.id));
              setNearbyRoads((prev) => prev.filter((r) => r.id !== road.id));
              if (selectedRoad?.id === road.id) setSelectedRoad(null);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Unknown error';
              Alert.alert('Delete Failed', msg);
            }
          },
        },
      ],
    );
  };

  const handleToggleVisibility = async (road: SavedRoad) => {
    const nextPublic = !road.isPublic;
    try {
      await toggleRoadVisibility(road.id, nextPublic);
      setMyRoads((prev) =>
        prev.map((r) => (r.id === road.id ? { ...r, isPublic: nextPublic } : r)),
      );
      if (selectedRoad?.id === road.id) {
        setSelectedRoad({ ...selectedRoad, isPublic: nextPublic });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Update Failed', msg);
    }
  };

  const activeList = activeTab === 'nearby' ? nearbyRoads : myRoads;

  const filteredRoads = useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const q = searchQuery.toLowerCase();
    return activeList.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }, [activeList, searchQuery]);

  const openNavigation = (road: SavedRoad) => {
    if (!road.routeWkt) {
      Alert.alert('No Route Data', 'Unable to parse route coordinates.');
      return;
    }
    // Extract first coordinate from WKT LINESTRING(lon lat, ...)
    const match = road.routeWkt.match(/LINESTRING\s*\(\s*([-\d.]+)\s+([-\d.]+)/i);
    if (match) {
      const lon = match[1];
      const lat = match[2];
      const url =
        Platform.OS === 'ios'
          ? `maps://?daddr=${lat},${lon}&dirflg=d`
          : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Maps Unavailable', 'Could not open external maps application.');
      });
    } else {
      Alert.alert('Route Details', `Head to ${road.name} to start your drive.`);
    }
  };

  return (
    <View style={styles.root}>
      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorite Roads</Text>
        <Text style={styles.headerSub}>
          Curated scenic & twisty drives discovered by drivers
        </Text>

        {/* Tab switch */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabItem, activeTab === 'nearby' && styles.tabItemActive]}
            onPress={() => setActiveTab('nearby')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'nearby' && styles.tabTextActive,
              ]}
            >
              NEARBY ROADS
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabItem, activeTab === 'my_roads' && styles.tabItemActive]}
            onPress={() => setActiveTab('my_roads')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'my_roads' && styles.tabTextActive,
              ]}
            >
              MY ROADS
            </Text>
          </Pressable>
        </View>

        {/* Search filter */}
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by road name or tags…"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accentCyan} />
          <Text style={styles.loadingText}>Finding best driving routes…</Text>
        </View>
      ) : activeTab === 'nearby' && (currentLon === null || currentLat === null) ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📡</Text>
          <Text style={styles.emptyTitle}>Acquiring GPS Fix</Text>
          <Text style={styles.emptySub}>
            Location access is needed to show scenic roads near your position.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}
            onPress={loadData}
          >
            <Text style={styles.ctaBtnText}>Retry Location</Text>
          </Pressable>
        </View>
      ) : filteredRoads.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>🛣️</Text>
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching roads found' : 'No saved roads yet'}
          </Text>
          <Text style={styles.emptySub}>
            {activeTab === 'nearby'
              ? 'No public roads recorded in this 100 km radius yet. Be the first to map a great route!'
              : 'Complete a drive in the Track tab and tap "Save Road" to add your favorite twisty routes.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.pressed]}
            onPress={() => router.push('/(tabs)/track')}
          >
            <Text style={styles.ctaBtnText}>Start a Drive</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredRoads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isOwner = user?.id === item.userId;
            return (
              <Pressable
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                onPress={() => setSelectedRoad(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.distanceMeters !== undefined && (
                      <Text style={styles.cardProximity}>
                        📍 {formatProximity(item.distanceMeters)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.badgeRow}>
                    <View style={styles.lengthBadge}>
                      <Text style={styles.lengthBadgeText}>
                        {formatRoadLength(item.lengthMeters)}
                      </Text>
                    </View>
                    {isOwner && (
                      <View
                        style={[
                          styles.visibilityBadge,
                          item.isPublic
                            ? styles.badgePublic
                            : styles.badgePrivate,
                        ]}
                      >
                        <Text style={styles.visibilityText}>
                          {item.isPublic ? 'PUBLIC' : 'PRIVATE'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}

                <View style={styles.cardFooter}>
                  <Text style={styles.cardAction}>Tap for details & navigation →</Text>
                  {isOwner && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteRoad(item);
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.deleteLink}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.accentCyan}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Road Details Modal */}
      {selectedRoad && (
        <Modal
          visible={!!selectedRoad}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedRoad(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {selectedRoad.name}
                  </Text>
                  <Text style={styles.modalSub}>
                    {formatRoadLength(selectedRoad.lengthMeters)}
                    {selectedRoad.distanceMeters !== undefined
                      ? ` · ${formatProximity(selectedRoad.distanceMeters)}`
                      : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSelectedRoad(null)}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </Pressable>
              </View>

              {selectedRoad.description ? (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>DESCRIPTION & NOTES</Text>
                  <Text style={styles.modalSectionText}>
                    {selectedRoad.description}
                  </Text>
                </View>
              ) : null}

              {user?.id === selectedRoad.userId && (
                <View style={styles.ownerControls}>
                  <Text style={styles.modalSectionLabel}>MANAGE ROAD</Text>
                  <View style={styles.ownerActions}>
                    <Pressable
                      style={({ pressed }) => [styles.ownerBtn, pressed && styles.pressed]}
                      onPress={() => handleToggleVisibility(selectedRoad)}
                    >
                      <Text style={styles.ownerBtnText}>
                        {selectedRoad.isPublic ? '🔒 Make Private' : '🌐 Make Public'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.ownerBtn,
                        styles.deleteBtn,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => handleDeleteRoad(selectedRoad)}
                    >
                      <Text style={[styles.ownerBtnText, styles.deleteBtnText]}>
                        🗑️ Delete
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [styles.navBtn, pressed && styles.pressed]}
                  onPress={() => openNavigation(selectedRoad)}
                >
                  <Text style={styles.navBtnText}>🧭 Navigate to Start</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.driveBtn, pressed && styles.pressed]}
                  onPress={() => {
                    setSelectedRoad(null);
                    router.push('/(tabs)/track');
                  }}
                >
                  <Text style={styles.driveBtnText}>🏎️ Drive Route</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  tabItemActive: {
    backgroundColor: Colors.bgElevated,
  },
  tabText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: Colors.accentCyan,
  },
  searchWrap: {
    marginTop: Spacing.md,
  },
  searchInput: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptySub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  ctaBtn: {
    backgroundColor: Colors.accentCyan,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
  ctaBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textInverse,
  },
  listContent: {
    padding: Spacing.base,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textPrimary,
  },
  cardProximity: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lengthBadge: {
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lengthBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textPrimary,
  },
  visibilityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  badgePublic: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
  },
  badgePrivate: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  visibilityText: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  cardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cardAction: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  deleteLink: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentRed,
  },
  separator: {
    height: Spacing.md,
  },
  pressed: {
    opacity: 0.75,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
  },
  modalSub: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  modalSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalSectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
  },
  modalSectionText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  ownerControls: {
    marginVertical: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ownerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  ownerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgBase,
  },
  ownerBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textPrimary,
  },
  deleteBtn: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  deleteBtnText: {
    color: Colors.accentRed,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.sm,
  },
  navBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.accentCyan,
  },
  driveBtn: {
    flex: 1,
    backgroundColor: Colors.accentCyan,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driveBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textInverse,
  },
});
