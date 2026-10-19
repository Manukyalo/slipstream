/**
 * TripSummarySheet — Complete Drive Recap & Route Snapshot Modal
 *
 * Requirements:
 *  - Full-screen modal presented immediately after ending a drive
 *  - Shows SlipstreamMap in recap mode:
 *      * Speed-coloured segments (cyan→blue→amber→red)
 *      * Cyan flag start marker
 *      * Chequered flag end marker
 *      * Amber pause pit-stop markers
 *      * Dashed lines for car movement during pit stops
 *      * Auto fitBounds to entire route
 *  - Captures high-res route snapshot via MapLibre WebView ref
 *  - Uploads snapshot to Supabase Storage bucket 'trip-snapshots' and patches trip row
 *  - Comprehensive stats grid: Distance, Moving Time, Total Duration, Avg Speed, Top Speed, Pit Stops
 *  - Actions: Share Run, Save Road, Dismiss
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Modal,
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { SlipstreamMap, type SlipstreamMapRef } from '@/components/map/SlipstreamMap';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicleContext } from '@/contexts/VehicleContext';
import { uploadTripSnapshotImage } from '@/services/trips';
import {
  buildSpeedColouredGeoJson,
  type TripMetrics,
} from '@/utils/telemetry';

export interface TripSummarySheetProps {
  visible: boolean;
  metrics: TripMetrics | null;
  onClose: () => void;
  onShare: (snapshotUrl?: string | null) => void;
  onSaveRoad?: () => void;
}

export function TripSummarySheet({
  visible,
  metrics,
  onClose,
  onShare,
  onSaveRoad,
}: TripSummarySheetProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { primaryVehicle } = useVehicleContext();
  const mapRef = useRef<SlipstreamMapRef>(null);

  const [snapshotState, setSnapshotState] = useState<'idle' | 'capturing' | 'uploaded' | 'failed'>('idle');
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  const routePoints = metrics?.routePoints;
  const startCoords = metrics?.startCoords;
  const endCoords = metrics?.endCoords;
  const pitStops = metrics?.pitStops;

  // Speed-coloured GeoJSON for recap
  const recapGeoJson = useMemo(() => {
    if (!routePoints || routePoints.length < 2) return null;
    return buildSpeedColouredGeoJson(routePoints);
  }, [routePoints]);

  // Marker coordinates
  const startCoord: [number, number] | null = useMemo(() => {
    if (startCoords) return startCoords;
    if (routePoints && routePoints.length > 0) {
      return [routePoints[0].lng, routePoints[0].lat];
    }
    return null;
  }, [startCoords, routePoints]);

  const endCoord: [number, number] | null = useMemo(() => {
    if (endCoords) return endCoords;
    if (routePoints && routePoints.length > 1) {
      const last = routePoints[routePoints.length - 1];
      return [last.lng, last.lat];
    }
    return null;
  }, [endCoords, routePoints]);

  const pitStopMarkers = useMemo(() => {
    if (!pitStops) return [];
    return pitStops.map((p) => ({
      id: p.id,
      lon: p.lng,
      lat: p.lat,
    }));
  }, [pitStops]);

  const dashedSegments = useMemo(() => {
    if (!pitStops) return [];
    return pitStops
      .filter((p) => p.resume_lat != null && p.resume_lng != null)
      .map((p) => ({
        id: `dash_${p.id}`,
        fromLon: p.lng,
        fromLat: p.lat,
        toLon: p.resume_lng as number,
        toLat: p.resume_lat as number,
      }));
  }, [pitStops]);

  // Handle route fitting and snapshot generation
  useEffect(() => {
    if (!visible || !metrics || !metrics.routePoints || metrics.routePoints.length < 2) return;

    let isMounted = true;

    const runCapture = async () => {
      setSnapshotState('capturing');
      // 1. Fit map bounds to show complete route
      const points: [number, number][] = metrics.routePoints.map((p) => [p.lng, p.lat]);
      mapRef.current?.fitBounds(points);

      // 2. Allow map tiles to load & settle
      await new Promise((r) => setTimeout(r, 1200));
      if (!isMounted) return;

      try {
        const localUri = await mapRef.current?.captureSnapshot();
        if (!localUri || !isMounted) {
          setSnapshotState('failed');
          return;
        }

        // 3. Upload to Supabase Storage if user is authenticated
        const tripKey = metrics.clientId ?? metrics.tripId ?? `trip_${Date.now()}`;
        if (user?.id) {
          const publicUrl = await uploadTripSnapshotImage(user.id, tripKey, localUri);
          if (isMounted) {
            setSnapshotUrl(publicUrl);
            setSnapshotState('uploaded');
          }
        } else {
          setSnapshotUrl(localUri);
          setSnapshotState('uploaded');
        }
      } catch (err) {
        console.warn('[TripSummarySheet] Snapshot workflow warning:', err);
        if (isMounted) {
          setSnapshotState('failed');
        }
      }
    };

    runCapture();

    return () => {
      isMounted = false;
    };
  }, [visible, metrics, user?.id]);

  if (!visible || !metrics) return null;

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const distanceKm = (metrics.distanceMeters / 1000).toFixed(2);
  const vehicleName = primaryVehicle
    ? `${primaryVehicle.year ?? ''} ${primaryVehicle.make} ${primaryVehicle.model}`.trim()
    : 'Slipstream Pilot';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View>
            <Text style={styles.navTitle}>DRIVE RECAP</Text>
            <Text style={styles.navSub}>Telemetry Run & Route Summary</Text>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7} hitSlop={8}>
            <Icon name="close" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Map Preview / Snapshot View */}
          <View style={styles.mapCard}>
            <View style={styles.mapWrap}>
              <SlipstreamMap
                ref={mapRef}
                recapGeoJson={recapGeoJson}
                startCoord={startCoord}
                endCoord={endCoord}
                pitStopMarkers={pitStopMarkers}
                dashedSegments={dashedSegments}
                followUser={false}
              />
            </View>

            {/* Snapshot Status Badge */}
            <View style={styles.snapshotBadge}>
              {snapshotState === 'capturing' && (
                <View style={styles.badgeRow}>
                  <ActivityIndicator size="small" color={Colors.accent.cyan} />
                  <Text style={styles.snapshotBadgeText}>Capturing route snapshot...</Text>
                </View>
              )}
              {snapshotState === 'uploaded' && (
                <View style={styles.badgeRow}>
                  <Icon name="check-circle" size={14} color={Colors.semantic.success} weight="fill" />
                  <Text style={[styles.snapshotBadgeText, { color: Colors.semantic.success }]}>
                    Route snapshot saved
                  </Text>
                </View>
              )}
              {snapshotState === 'failed' && (
                <View style={styles.badgeRow}>
                  <Icon name="warning" size={14} color={Colors.text.tertiary} />
                  <Text style={styles.snapshotBadgeText}>Live map rendered</Text>
                </View>
              )}
            </View>
          </View>

          {/* Vehicle info card */}
          {primaryVehicle && (
            <View style={styles.vehicleRow}>
              {primaryVehicle.photo_url ? (
                <Image source={{ uri: primaryVehicle.photo_url }} style={styles.vehiclePhoto} />
              ) : (
                <View style={styles.vehicleIconBox}>
                  <Icon name="car" size={18} color={Colors.accent.cyan} weight="duotone" />
                </View>
              )}
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleName} numberOfLines={1}>
                  {vehicleName}
                </Text>
                <Text style={styles.vehicleMeta}>
                  {primaryVehicle.nickname ? `${primaryVehicle.nickname} · ` : ''}Active Garage Vehicle
                </Text>
              </View>
            </View>
          )}

          {/* Core Metrics Grid */}
          <View style={styles.metricsGrid}>
            {/* Tile 1: Distance */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Icon name="path" size={16} color={Colors.accent.cyan} weight="duotone" />
                <Text style={styles.metricLabel}>DISTANCE</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricNumber} tabular>{distanceKm}</Text>
                <Text style={styles.metricUnit}>km</Text>
              </View>
            </View>

            {/* Tile 2: Moving Time */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Icon name="timer" size={16} color={Colors.accent.blue} weight="duotone" />
                <Text style={styles.metricLabel}>MOVING TIME</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricNumber} tabular>
                  {formatDuration(metrics.movingTimeSeconds)}
                </Text>
              </View>
              <Text style={styles.metricSub}>
                Wall: {formatDuration(metrics.durationSeconds)}
              </Text>
            </View>

            {/* Tile 3: Avg Speed */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Icon name="gauge" size={16} color={Colors.semantic.success} weight="duotone" />
                <Text style={styles.metricLabel}>AVG SPEED</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricNumber} tabular>{metrics.avgSpeedKmh.toFixed(1)}</Text>
                <Text style={styles.metricUnit}>km/h</Text>
              </View>
              <Text style={styles.metricSub}>excludes pit stops</Text>
            </View>

            {/* Tile 4: Top Speed */}
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Icon name="lightning" size={16} color={Colors.accent.cyan} weight="fill" />
                <Text style={styles.metricLabel}>TOP SPEED</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricNumber} tabular>{metrics.topSpeedKmh}</Text>
                <Text style={styles.metricUnit}>km/h</Text>
              </View>
            </View>

            {/* Tile 5: Pit Stops */}
            <View style={[styles.metricCard, styles.metricCardWide]}>
              <View style={styles.metricHeader}>
                <Icon name="pause" size={16} color={Colors.semantic.warning} weight="fill" />
                <Text style={styles.metricLabel}>PIT STOPS</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricNumber} tabular>{metrics.pitStopCount}</Text>
                <Text style={styles.metricUnit}>
                  {metrics.pitStopCount === 1 ? 'stop' : 'stops'} · {formatDuration(metrics.pitStopTotalSeconds)} total
                </Text>
              </View>
              {metrics.pitStops && metrics.pitStops.length > 0 && (
                <View style={styles.pitTagsRow}>
                  {metrics.pitStops.map((stop, i) => (
                    <View key={stop.id || i} style={styles.pitTagPill}>
                      <Text style={styles.pitTagText}>
                        Stop {i + 1}: {stop.tag ? stop.tag.toUpperCase() : 'STOP'} ({formatDuration(stop.duration_s)})
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Actions Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => onShare(snapshotUrl)}
            activeOpacity={0.85}
          >
            <Icon name="share" size={18} color={Colors.bg.base} weight="bold" />
            <Text style={styles.shareBtnText}>Share Run</Text>
          </TouchableOpacity>

          {onSaveRoad && (
            <TouchableOpacity
              style={styles.saveRoadBtn}
              onPress={onSaveRoad}
              activeOpacity={0.8}
            >
              <Icon name="bookmark" size={16} color={Colors.accent.cyan} weight="duotone" />
              <Text style={styles.saveRoadBtnText}>Save Road</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  navTitle: {
    fontFamily: FontFamily.display,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 0.8,
  },
  navSub: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface['2'],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  scrollContent: {
    padding: Spacing[4],
    gap: Spacing[3],
  },
  mapCard: {
    height: 250,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    position: 'relative',
  },
  mapWrap: {
    ...StyleSheet.absoluteFill,
  },
  snapshotBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  snapshotBadgeText: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  vehiclePhoto: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface['2'],
  },
  vehicleIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface['2'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  vehicleMeta: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.hairline,
    gap: 4,
  },
  metricCardWide: {
    width: '100%',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontFamily: FontFamily.heading,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricNumber: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  metricUnit: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.text.secondary,
  },
  metricSub: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.text.tertiary,
  },
  pitTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  pitTagPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pitTagText: {
    fontFamily: FontFamily.heading,
    fontSize: 11,
    color: Colors.semantic.warning,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[4],
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    backgroundColor: Colors.surface['1'],
  },
  shareBtn: {
    flex: 2,
    height: 48,
    borderRadius: Radius.button,
    backgroundColor: Colors.accent.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: {
    fontFamily: FontFamily.display,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bg.base,
  },
  saveRoadBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveRoadBtnText: {
    ...Typography.label,
    color: Colors.accent.cyan,
  },
  doneBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: Radius.button,
    backgroundColor: Colors.surface['2'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    ...Typography.label,
    color: Colors.text.secondary,
  },
});
