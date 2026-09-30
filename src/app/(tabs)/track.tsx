import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Route as RouteIcon, Timer, Gauge, AlertTriangle, Download, Car, Share2, BookmarkPlus } from 'lucide-react-native';
import { Theme, StatRow } from '@/constants/theme';
import { useTracking } from '@/contexts/TrackingContext';
import { Speedometer } from '@/components/tracking/Speedometer';
import { SlipstreamMap } from '@/components/map/SlipstreamMap';
import { useOfflineMap } from '@/hooks/useOfflineMap';
import { useVehicles } from '@/hooks/useVehicles';
import { useHazardAlerts } from '@/hooks/useHazardAlerts';
import { HazardAlertBanner } from '@/components/hazards/HazardAlertBanner';
import { HazardReportModal } from '@/components/hazards/HazardReportModal';
import { LocationConsentModal } from '@/components/compliance/LocationConsentModal';
import { ShareRecapModal } from '@/components/recap/ShareRecapModal';
import { SaveRoadModal } from '@/components/roads/SaveRoadModal';
import { type GenerateRecapCardParams } from '@/services/shareCard';
import { hasUserConsentedLocation, setUserLocationConsent } from '@/services/compliance';
import { TripMetrics } from '@/utils/telemetry';

export default function TrackScreen() {
  const {
    isTracking,
    currentSpeedKmh,
    topSpeedKmh,
    elapsedSeconds,
    distanceMeters,
    currentCoords,
    routeGeoJson,
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
  const [reportModalVisible, setReportModalVisible] = useState<boolean>(false);
  const [consentModalVisible, setConsentModalVisible] = useState<boolean>(false);
  const [saveRoadModalVisible, setSaveRoadModalVisible] = useState<boolean>(false);
  const [completedMetrics, setCompletedMetrics] = useState<TripMetrics | null>(null);
  const [shareParams, setShareParams] = useState<GenerateRecapCardParams | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const proceedWithTracking = async () => {
    if (!permissionGranted) {
      const ok = await requestPermissions();
      if (!ok) {
        Alert.alert('Permission Required', 'Location access is required to track your route.');
        return;
      }
    }
    setCompletedMetrics(null);
    await startTracking();
  };

  const handleStartStop = async () => {
    if (isTracking) {
      const summary = await stopTracking();
      if (summary) {
        setCompletedMetrics(summary);
      }
      return;
    }

    const hasConsented = await hasUserConsentedLocation();
    if (!hasConsented) {
      setConsentModalVisible(true);
      return;
    }

    await proceedWithTracking();
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
      Alert.alert('Acquiring GPS', 'Waiting for current GPS coordinates before downloading map.');
      return;
    }
    downloadCurrentArea(currentCoords);
  };

  const avgSpeed = elapsedSeconds > 0 ? ((distanceMeters / elapsedSeconds) * 3.6).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      {/* Approaching Hazard Alert Banner */}
      {activeAlert && (
        <HazardAlertBanner
          hazard={activeAlert}
          onConfirm={confirmCurrentHazard}
          onDismiss={dismissAlert}
        />
      )}

      {/* Map layer */}
      <View style={styles.mapContainer}>
        <SlipstreamMap
          centerCoordinate={currentCoords ?? undefined}
          routeGeoJson={routeGeoJson}
          followUser={isTracking}
          zoomLevel={15}
        />

        {/* Section 1: Connected Status Strip (single surface-raised background, hairline dividers) */}
        <View style={styles.connectedStrip}>
          {/* Segment 1: Live Status */}
          <View style={styles.stripSegment}>
            <View style={[styles.statusDot, isTracking ? styles.dotLive : styles.dotReady]} />
            <Text style={styles.stripText}>{isTracking ? 'Live' : 'Ready'}</Text>
          </View>

          <View style={styles.stripDivider} />

          {/* Segment 2: Offline Map */}
          <Pressable
            style={({ pressed }) => [styles.stripSegment, pressed && styles.pressed]}
            onPress={handleOfflineDownload}
            disabled={downloadState.isDownloading}
          >
            <Download size={13} strokeWidth={1.5} color={Theme.colors.textMuted} />
            <Text style={styles.stripText}>
              {downloadState.isDownloading
                ? `${downloadState.progressPercentage}%`
                : downloadState.completed
                ? 'Offline ready'
                : 'Offline map'}
            </Text>
          </Pressable>

          <View style={styles.stripDivider} />

          {/* Segment 3: Drop Pin */}
          <Pressable
            style={({ pressed }) => [styles.stripSegment, pressed && styles.pressed]}
            onPress={() => {
              if (!currentCoords) {
                Alert.alert('GPS Required', 'Waiting for location fix to drop a hazard pin.');
                return;
              }
              setReportModalVisible(true);
            }}
          >
            <AlertTriangle size={13} strokeWidth={1.5} color={Theme.colors.flagRed} />
            <Text style={[styles.stripText, { color: Theme.colors.flagRed }]}>Drop pin</Text>
          </Pressable>
        </View>
      </View>

      {/* Cockpit telemetry panel in bottom half */}
      <View style={styles.telemetryContainer}>
        {primaryVehicle ? (
          <View style={styles.vehicleHeader}>
            <Car size={14} strokeWidth={1.5} color={Theme.colors.textMuted} />
            <Text style={styles.vehicleHeaderText} numberOfLines={1}>
              {primaryVehicle.year} {primaryVehicle.make} {primaryVehicle.model}
              {primaryVehicle.nickname ? ` · ${primaryVehicle.nickname}` : ''}
            </Text>
          </View>
        ) : null}

        {/* Speed Dial: no card chrome, type on void */}
        <View style={styles.speedometerWrap}>
          <Speedometer speedKmh={currentSpeedKmh} topSpeedKmh={topSpeedKmh} />
        </View>

        {/* Trip Stats Footer: flat list with StatRow primitive */}
        <View style={styles.statsList}>
          <StatRow
            icon={RouteIcon}
            label="Distance"
            value={(distanceMeters / 1000).toFixed(2)}
            unit="km"
          />
          <StatRow
            icon={Timer}
            label="Elapsed"
            value={formatDuration(elapsedSeconds)}
          />
          <StatRow
            icon={Gauge}
            label="Average"
            value={avgSpeed}
            unit="km/h"
            isLast={true}
          />
        </View>

        {/* Saved trip confirmation banner */}
        {completedMetrics ? (
          <View style={styles.savedBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedTitle}>Trip saved to cloud</Text>
              <Text style={styles.savedMeta}>
                {(completedMetrics.distanceMeters / 1000).toFixed(2)} km · Top {completedMetrics.topSpeedKmh} km/h · Avg {completedMetrics.avgSpeedKmh} km/h
              </Text>
            </View>
            <View style={styles.savedActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.savedActionBtn, pressed && styles.pressed]}
                onPress={() => setSaveRoadModalVisible(true)}
              >
                <BookmarkPlus size={14} strokeWidth={1.5} color={Theme.colors.signalCyan} />
                <Text style={styles.savedActionBtnText}>Save road</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.savedActionBtn, pressed && styles.pressed]}
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
              >
                <Share2 size={14} strokeWidth={1.5} color={Theme.colors.textPrimary} />
                <Text style={styles.savedActionBtnText}>Share</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Primary Action Button: ignition-amber flat-fill, Inter medium, sentence case */}
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            isTracking ? styles.ctaStop : styles.ctaStart,
            pressed && styles.pressed,
          ]}
          onPress={handleStartStop}
        >
          <Text style={[styles.ctaText, isTracking && styles.ctaStopText]}>
            {isTracking ? 'Stop tracking' : 'Start tracking'}
          </Text>
        </Pressable>
      </View>

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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.bgVoid,
  },
  mapContainer: {
    flex: 1.05,
    position: 'relative',
  },
  // Connected status strip: single surface-raised background, hairline dividers between segments
  connectedStrip: {
    position: 'absolute',
    top: 54,
    left: Theme.spacing.base,
    right: Theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surfaceRaised,
    borderRadius: Theme.radius.sm,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceBorder,
    zIndex: 10,
  },
  stripSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  stripDivider: {
    width: 1,
    height: 18,
    backgroundColor: Theme.colors.hairline,
  },
  stripText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.textPrimary,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotLive: {
    backgroundColor: Theme.colors.signalCyan,
  },
  dotReady: {
    backgroundColor: Theme.colors.textMuted,
  },
  telemetryContainer: {
    flex: 1.35,
    backgroundColor: Theme.colors.surface,
    borderTopLeftRadius: Theme.radius.lg,
    borderTopRightRadius: Theme.radius.lg,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.surfaceBorder,
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.xl,
    justifyContent: 'space-between',
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  vehicleHeaderText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  speedometerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsList: {
    marginVertical: 4,
  },
  savedBanner: {
    backgroundColor: Theme.colors.surfaceRaised,
    borderColor: Theme.colors.signalCyan,
    borderWidth: 1,
    borderRadius: Theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
    marginBottom: 4,
  },
  savedTitle: {
    fontFamily: Theme.fonts.bodySemiBold,
    fontSize: 12,
    color: Theme.colors.signalCyan,
  },
  savedMeta: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  savedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Theme.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Theme.radius.xs,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceBorder,
  },
  savedActionBtnText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: Theme.colors.textPrimary,
  },
  // Flat-fill ignition-amber button, Inter medium, sentence case
  ctaButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaStart: {
    backgroundColor: Theme.colors.ignitionAmber,
  },
  ctaStop: {
    backgroundColor: Theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Theme.colors.flagRed,
  },
  ctaText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 15,
    color: Theme.colors.textInverse,
    letterSpacing: 0.3,
  },
  ctaStopText: {
    color: Theme.colors.flagRed,
  },
  pressed: {
    opacity: 0.82,
  },
});
