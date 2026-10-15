/**
 * TrackScreen — Slipstream Live Drive & Precision Telemetry
 *
 * Phase 3 Architecture:
 *  - Full-bleed dark map powered by MapLibre & OpenFreeMap Dark tiles
 *  - Floating glass pill: GPS quality indicator (Acquiring, Good, Weak), offline map, and hazard reporting
 *  - Bottom cockpit card (surface.1 #0E131B, radius 28, 20px padding, 12px gap)
 *  - Precision Gauge: 0 to 260 km/h, cyan-to-blue arc turning amber (>120 km/h) and red (>180 km/h)
 *  - 3 metric tiles (Distance, Elapsed, Average) with Phosphor IconChips & tabular figures
 *  - Primary CTA: Gradient cyan-to-blue Start Drive; interactive 1.5s Hold-to-Stop when recording
 *  - Explicit states: Permission needed, acquiring GPS, recording, auto-paused, saving, saved-summary sheet
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTracking } from '@/contexts/TrackingContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useOfflineMap } from '@/hooks/useOfflineMap';
import { useHazardAlerts } from '@/hooks/useHazardAlerts';
import { SlipstreamMap } from '@/components/map/SlipstreamMap';
import { Gauge } from '@/components/ui/Gauge';
import { TrackTopPill } from '@/components/tracking/TrackTopPill';
import { TrackDriveButton } from '@/components/tracking/TrackDriveButton';
import { IconChip } from '@/components/ui/IconChip';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { HazardAlertBanner } from '@/components/hazards/HazardAlertBanner';
import { HazardReportModal } from '@/components/hazards/HazardReportModal';
import { LocationConsentModal } from '@/components/compliance/LocationConsentModal';
import { ShareRecapModal } from '@/components/recap/ShareRecapModal';
import { SaveRoadModal } from '@/components/roads/SaveRoadModal';
import { type GenerateRecapCardParams } from '@/services/shareCard';
import { hasUserConsentedLocation, setUserLocationConsent } from '@/services/compliance';
import { TripMetrics } from '@/utils/telemetry';
import { toUserMessage } from '@/utils/toUserMessage';

export default function TrackScreen() {
  const insets = useSafeAreaInsets();
  const {
    isTracking,
    currentSpeedKmh,
    elapsedSeconds,
    distanceMeters,
    currentCoords,
    gpsAccuracy,
    heading,
    routeGeoJson,
    isSaving,
    startTracking,
    stopTracking,
    permissionGranted,
    requestPermissions,
  } = useTracking();

  const { primaryVehicle } = useVehicles();
  const { downloadState, downloadCurrentArea } = useOfflineMap();
  const {
    activeAlert,
    dismissAlert,
    confirmCurrentHazard,
    reportPin,
  } = useHazardAlerts({ currentCoords, isTracking });

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [saveRoadModalVisible, setSaveRoadModalVisible] = useState(false);
  const [completedMetrics, setCompletedMetrics] = useState<TripMetrics | null>(null);
  const [shareParams, setShareParams] = useState<GenerateRecapCardParams | null>(null);

  // Pulsing animation for the recording indicator
  const [recPulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation | null = null;
    if (isTracking) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(recPulseAnim, {
            toValue: 0.25,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(recPulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();
    } else {
      recPulseAnim.setValue(1);
    }
    return () => {
      pulseLoop?.stop();
    };
  }, [isTracking, recPulseAnim]);

  // Duration formatted as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Average speed in km/h with 1 decimal place
  const avgSpeed =
    elapsedSeconds > 0 ? ((distanceMeters / elapsedSeconds) * 3.6).toFixed(1) : '0.0';

  // Derived state: Auto-paused when recording but vehicle is stationary
  const isAutoPaused = isTracking && currentSpeedKmh < 1.0;

  // Derived state: GPS Lock acquiring
  const isGpsAcquiring = currentCoords === null || gpsAccuracy === null || gpsAccuracy > 25;

  const proceedWithTracking = async () => {
    try {
      if (!permissionGranted) {
        const ok = await requestPermissions();
        if (!ok) {
          Alert.alert(
            'Location Permission Required',
            'Slipstream requires location access to record drives and warn of hazards.',
          );
          return;
        }
      }
      setCompletedMetrics(null);
      await startTracking();
    } catch (err) {
      const userMsg = toUserMessage(err);
      Alert.alert('Unable to Start Tracking', userMsg);
    }
  };

  const handleStart = async () => {
    try {
      const hasConsented = await hasUserConsentedLocation();
      if (!hasConsented) {
        setConsentModalVisible(true);
        return;
      }
      await proceedWithTracking();
    } catch (err) {
      const userMsg = toUserMessage(err);
      Alert.alert('Location Check Failed', userMsg);
    }
  };

  const handleStop = async () => {
    try {
      const summary = await stopTracking();
      if (summary) {
        setCompletedMetrics(summary);
      }
    } catch (err) {
      const userMsg = toUserMessage(err);
      Alert.alert('Error Saving Drive', userMsg);
    }
  };

  const handleAcceptConsent = async () => {
    await setUserLocationConsent(true);
    setConsentModalVisible(false);
    await proceedWithTracking();
  };

  const handleDeclineConsent = () => {
    setConsentModalVisible(false);
  };

  const handleOfflineDownload = () => {
    if (!currentCoords) {
      Alert.alert('Acquiring GPS', 'Waiting for GPS fix before downloading offline tiles.');
      return;
    }
    downloadCurrentArea(currentCoords);
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        {/* Full-bleed Dark Map */}
        <View style={styles.mapContainer}>
          <SlipstreamMap
            centerCoordinate={currentCoords ?? undefined}
            routeGeoJson={routeGeoJson}
            followUser={isTracking}
            heading={heading}
            zoomLevel={16}
          />

          {/* Floating Top Glass Pill */}
          <View style={[styles.topPillWrapper, { top: insets.top + 8 }]}>
            <TrackTopPill
              gpsAccuracy={gpsAccuracy}
              downloadState={
                downloadState.isDownloading
                  ? 'downloading'
                  : downloadState.completed
                  ? 'ready'
                  : 'idle'
              }
              downloadPercentage={downloadState.progressPercentage}
              onOfflineMapPress={handleOfflineDownload}
              onReportHazardPress={() => {
                if (!currentCoords) {
                  Alert.alert('GPS Fix Required', 'Waiting for location fix to drop a hazard pin.');
                  return;
                }
                setReportModalVisible(true);
              }}
            />
          </View>

          {/* Approaching Hazard Alert Banner */}
          {activeAlert && (
            <View style={[styles.alertBannerWrapper, { top: insets.top + 64 }]}>
              <HazardAlertBanner
                hazard={activeAlert}
                onConfirm={confirmCurrentHazard}
                onDismiss={dismissAlert}
              />
            </View>
          )}

          {/* Explicit State: Permission Needed Overlay */}
          {!permissionGranted && (
            <View style={[styles.stateNoticeCard, { top: insets.top + 68 }]}>
              <View style={styles.stateNoticeIcon}>
                <Icon name="map-pin" size={16} color={Colors.semantic.warning} weight="duotone" />
              </View>
              <View style={styles.stateNoticeContent}>
                <Text style={styles.stateNoticeTitle}>Location Access Required</Text>
                <Text style={styles.stateNoticeBody}>
                  Enable location to track your route and see live telemetry.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.stateNoticeAction}
                onPress={requestPermissions}
                activeOpacity={0.8}
              >
                <Text style={styles.stateNoticeActionText}>Enable</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Explicit State: GPS Acquiring Banner (when permission is granted but no lock yet) */}
          {permissionGranted && isGpsAcquiring && !isTracking && (
            <View style={[styles.acquiringChip, { top: insets.top + 68 }]}>
              <View style={styles.amberDot} />
              <Text style={styles.acquiringText}>Acquiring GPS lock...</Text>
            </View>
          )}
        </View>

        {/* Bottom Cockpit Card (surface.1 #0E131B, radius 28, 20px padding, 12px gap) */}
        <View style={[styles.bottomCockpitSheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          {/* Header Row: Vehicle info & Live Telemetry status */}
          <View style={styles.cockpitHeader}>
            {primaryVehicle ? (
              <View style={styles.vehicleChip}>
                <Icon name="car" size={14} color={Colors.text.secondary} weight="regular" />
                <Text style={styles.vehicleText} numberOfLines={1}>
                  {primaryVehicle.year} {primaryVehicle.make} {primaryVehicle.model}
                  {primaryVehicle.nickname ? ` · ${primaryVehicle.nickname}` : ''}
                </Text>
              </View>
            ) : (
              <View style={styles.vehicleChip}>
                <Icon name="gauge" size={14} color={Colors.accent.cyan} weight="duotone" />
                <Text style={styles.vehicleText}>Precision Telemetry</Text>
              </View>
            )}

            {/* Recording / Auto-paused badge */}
            {isTracking ? (
              <View style={styles.statusChipsRow}>
                {isAutoPaused && (
                  <View style={styles.autoPauseChip}>
                    <Text style={styles.autoPauseText}>AUTO-PAUSED</Text>
                  </View>
                )}
                <View style={styles.recBadge}>
                  <Animated.View style={[styles.recDot, { opacity: recPulseAnim }]} />
                  <Text style={styles.recText}>REC</Text>
                  <Text style={styles.recDuration}>{formatDuration(elapsedSeconds)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.readyBadge}>
                <View style={[styles.statusDot, isGpsAcquiring ? styles.dotAmber : styles.dotGreen]} />
                <Text style={styles.readyText}>
                  {isGpsAcquiring ? 'ACQUIRING' : 'GPS LOCKED'}
                </Text>
              </View>
            )}
          </View>

          {/* Center Instrument: Precision 0 to 260 km/h Gauge */}
          <View style={styles.gaugeContainer}>
            <Gauge speedKmh={currentSpeedKmh} maxDialSpeed={260} size={250} />
          </View>

          {/* 3 Metric Tiles (Distance, Elapsed, Average) with Phosphor IconChips */}
          <View style={styles.metricsGrid}>
            {/* Tile 1: Distance */}
            <View style={styles.metricTile}>
              <View style={styles.metricTileHeader}>
                <IconChip name="path" color="cyan" size={16} chipSize={32} />
                <Text style={styles.metricLabel}>DISTANCE</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>
                  {(distanceMeters / 1000).toFixed(2)}
                </Text>
                <Text style={styles.metricUnit}>km</Text>
              </View>
            </View>

            {/* Tile 2: Elapsed */}
            <View style={styles.metricTile}>
              <View style={styles.metricTileHeader}>
                <IconChip name="timer" color="blue" size={16} chipSize={32} />
                <Text style={styles.metricLabel}>ELAPSED</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>
                  {formatDuration(elapsedSeconds)}
                </Text>
              </View>
            </View>

            {/* Tile 3: Average */}
            <View style={styles.metricTile}>
              <View style={styles.metricTileHeader}>
                <IconChip name="gauge" color="success" size={16} chipSize={32} />
                <Text style={styles.metricLabel}>AVERAGE</Text>
              </View>
              <View style={styles.metricValueRow}>
                <Text style={styles.metricValue}>{avgSpeed}</Text>
                <Text style={styles.metricUnit}>km/h</Text>
              </View>
            </View>
          </View>

          {/* Saved-Summary Sheet Banner (Explicit state after drive completion) */}
          {completedMetrics && !isTracking && (
            <View style={styles.savedBanner}>
              <View style={styles.savedContent}>
                <View style={styles.savedTitleRow}>
                  <Icon name="check-circle" size={16} color={Colors.semantic.success} weight="fill" />
                  <Text style={styles.savedTitle}>Drive Saved to Cloud</Text>
                </View>
                <Text style={styles.savedMeta}>
                  {(completedMetrics.distanceMeters / 1000).toFixed(2)} km · Top {completedMetrics.topSpeedKmh} km/h · Avg {completedMetrics.avgSpeedKmh} km/h
                </Text>
              </View>

              <View style={styles.savedActions}>
                <TouchableOpacity
                  style={styles.savedActionBtn}
                  onPress={() => setSaveRoadModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Icon name="bookmark" size={14} color={Colors.accent.cyan} weight="duotone" />
                  <Text style={styles.savedActionText}>Save road</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.savedActionBtn, styles.savedShareBtn]}
                  onPress={() =>
                    setShareParams({
                      type: 'trip',
                      headline: 'SLIPSTREAM TELEMETRY RUN',
                      topSpeedKmh: completedMetrics.topSpeedKmh,
                      distanceMeters: completedMetrics.distanceMeters,
                      durationSeconds: completedMetrics.durationSeconds,
                      vehicleName: primaryVehicle
                        ? `${primaryVehicle.year ?? ''} ${primaryVehicle.make} ${primaryVehicle.model}`.trim()
                        : undefined,
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Icon name="share" size={14} color={Colors.text.primary} weight="regular" />
                  <Text style={styles.savedActionText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.savedDismissBtn}
                  onPress={() => setCompletedMetrics(null)}
                  activeOpacity={0.7}
                  accessibilityLabel="Dismiss summary"
                >
                  <Icon name="close" size={14} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Primary Action Button: Start Drive / Hold to Stop */}
          <TrackDriveButton
            isTracking={isTracking}
            isSaving={isSaving}
            onStart={handleStart}
            onStop={handleStop}
          />
        </View>

        {/* Modals & Dialogs */}
        <HazardReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onReport={reportPin}
        />

        <LocationConsentModal
          visible={consentModalVisible}
          onAccept={handleAcceptConsent}
          onDecline={handleDeclineConsent}
        />

        <ShareRecapModal
          visible={!!shareParams}
          params={shareParams}
          onClose={() => setShareParams(null)}
        />

        <SaveRoadModal
          visible={saveRoadModalVisible}
          onClose={() => setSaveRoadModalVisible(false)}
          routeWkt={completedMetrics?.lineStringWkt ?? null}
          distanceMeters={completedMetrics?.distanceMeters ?? 0}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.base, // #05070D
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  topPillWrapper: {
    position: 'absolute',
    left: Spacing.screen,
    right: Spacing.screen,
    zIndex: 20,
  },
  alertBannerWrapper: {
    position: 'absolute',
    left: Spacing.screen,
    right: Spacing.screen,
    zIndex: 19,
  },

  // State Notice Cards (Permission Needed & Acquiring GPS)
  stateNoticeCard: {
    position: 'absolute',
    left: Spacing.screen,
    right: Spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 19, 27, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: Radius.card,
    padding: Spacing[4],
    gap: Spacing[2],
    zIndex: 18,
  },
  stateNoticeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.tint.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateNoticeContent: {
    flex: 1,
  },
  stateNoticeTitle: {
    fontFamily: FontFamily.heading,
    color: Colors.text.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  stateNoticeBody: {
    fontFamily: FontFamily.body,
    color: Colors.text.secondary,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  stateNoticeAction: {
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
  },
  stateNoticeActionText: {
    fontFamily: FontFamily.heading,
    color: Colors.bg.base,
    fontSize: 11,
  },

  acquiringChip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(14, 19, 27, 0.9)',
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    zIndex: 18,
  },
  amberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.semantic.warning,
  },
  acquiringText: {
    fontFamily: FontFamily.heading,
    color: Colors.text.secondary,
    fontSize: 12,
  },

  // Bottom Cockpit Sheet (surface.1 #0E131B, radius 28, 20px padding, 12px gap)
  bottomCockpitSheet: {
    backgroundColor: Colors.surface[1], // #0E131B
    borderTopLeftRadius: Radius.sheet, // 28
    borderTopRightRadius: Radius.sheet, // 28
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    paddingHorizontal: Spacing.screen, // 20
    paddingTop: Spacing[4], // 16
    gap: Spacing.gap, // 12
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
  },
  cockpitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  vehicleText: {
    fontFamily: FontFamily.body,
    color: Colors.text.secondary,
    fontSize: 12,
  },
  statusChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  autoPauseChip: {
    backgroundColor: Colors.tint.warning,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  autoPauseText: {
    fontFamily: FontFamily.heading,
    fontSize: 9,
    color: Colors.semantic.warning,
    letterSpacing: 0.8,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.tint.danger,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.semantic.danger,
  },
  recText: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    color: Colors.semantic.danger,
    letterSpacing: 0.8,
  },
  recDuration: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotGreen: {
    backgroundColor: Colors.semantic.success,
  },
  dotAmber: {
    backgroundColor: Colors.semantic.warning,
  },
  readyText: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    color: Colors.text.tertiary,
    letterSpacing: 0.6,
  },

  // Gauge instrument wrap
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -8,
  },

  // 3 Metric Tiles (surface.2 #151B26, radius 16, hairline border, tabular figures)
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricTile: {
    flex: 1,
    backgroundColor: Colors.surface[2], // #151B26
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: 10,
    gap: 4,
  },
  metricTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontFamily: FontFamily.overline,
    color: Colors.text.tertiary,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 2,
  },
  metricValue: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  metricUnit: {
    fontFamily: FontFamily.heading,
    color: Colors.text.tertiary,
    fontSize: 10,
  },

  // Saved drive confirmation banner
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface[2],
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.4)',
    borderRadius: Radius.card,
    padding: 10,
    gap: 8,
  },
  savedContent: {
    flex: 1,
  },
  savedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  savedTitle: {
    color: Colors.accent.cyan,
    fontFamily: FontFamily.heading,
    fontSize: 12,
  },
  savedMeta: {
    fontFamily: FontFamily.body,
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
    fontSize: 10,
    marginTop: 2,
  },
  savedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface[1],
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  savedShareBtn: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  savedActionText: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.text.primary,
  },
  savedDismissBtn: {
    padding: 4,
  },
});
