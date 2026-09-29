import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
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

      {/* Map layer in top half */}
      <View style={styles.mapContainer}>
        <SlipstreamMap
          centerCoordinate={currentCoords ?? undefined}
          routeGeoJson={routeGeoJson}
          followUser={isTracking}
          zoomLevel={15}
        />

        {/* Map overlay controls */}
        <View style={styles.mapHeaderOverlay}>
          <Pressable
            style={({ pressed }) => [styles.offlineBtn, pressed && styles.btnPressed]}
            onPress={handleOfflineDownload}
            disabled={downloadState.isDownloading}
          >
            <Text style={styles.offlineBtnText}>
              {downloadState.isDownloading
                ? `MAP ${downloadState.progressPercentage}%`
                : downloadState.completed
                ? 'OFFLINE READY'
                : 'OFFLINE MAP'}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.hazardPinBtn, pressed && styles.btnPressed]}
            onPress={() => {
              if (!currentCoords) {
                Alert.alert('GPS Required', 'Waiting for location fix to drop a hazard pin.');
                return;
              }
              setReportModalVisible(true);
            }}
          >
            <Text style={styles.hazardPinText}>⚠️ DROP PIN</Text>
          </Pressable>
        </View>

        {/* Live GPS / status chip */}
        <View style={styles.statusChip}>
          <View style={[styles.statusDot, isTracking ? styles.dotGreen : styles.dotCyan]} />
          <Text style={styles.statusText}>{isTracking ? 'RECORDING' : 'READY'}</Text>
        </View>
      </View>

      {/* Cockpit telemetry panel in bottom half */}
      <View style={styles.telemetryContainer}>
        {primaryVehicle ? (
          <View style={styles.vehiclePill}>
            <Text style={styles.vehiclePillText} numberOfLines={1}>
              🏎️ {primaryVehicle.year} {primaryVehicle.make} {primaryVehicle.model}
              {primaryVehicle.nickname ? ` · ${primaryVehicle.nickname}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={styles.speedometerWrap}>
          <Speedometer speedKmh={currentSpeedKmh} topSpeedKmh={topSpeedKmh} />
        </View>

        {/* Telemetry Stats Bar */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{(distanceMeters / 1000).toFixed(2)}</Text>
            <Text style={styles.statLabel}>KM DISTANCE</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatDuration(elapsedSeconds)}</Text>
            <Text style={styles.statLabel}>DURATION</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {elapsedSeconds > 0
                ? ((distanceMeters / elapsedSeconds) * 3.6).toFixed(1)
                : '0.0'}
            </Text>
            <Text style={styles.statLabel}>AVG KM/H</Text>
          </View>
        </View>

        {/* Saved trip confirmation banner */}
        {completedMetrics ? (
          <View style={styles.savedBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedTitle}>TRIP SAVED TO CLOUD</Text>
              <Text style={styles.savedMeta}>
                {(completedMetrics.distanceMeters / 1000).toFixed(2)} km · Top {completedMetrics.topSpeedKmh} km/h · Avg {completedMetrics.avgSpeedKmh} km/h
              </Text>
            </View>
            <View style={styles.savedActionsRow}>
              <Pressable
                style={({ pressed }) => [styles.saveRoadBtn, pressed && styles.btnPressed]}
                onPress={() => setSaveRoadModalVisible(true)}
              >
                <Text style={styles.saveRoadBtnText}>🛣️ SAVE ROAD</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.shareTripBtn, pressed && styles.btnPressed]}
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
                <Text style={styles.shareTripBtnText}>📸 STORY</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Start / Stop control button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            isTracking ? styles.stopButton : styles.startButton,
            pressed && styles.btnPressed,
          ]}
          onPress={handleStartStop}
        >
          <Text style={[styles.actionBtnText, isTracking && styles.stopBtnText]}>
            {isTracking ? 'FINISH & SAVE TRIP' : 'START TRACKING'}
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
    backgroundColor: Colors.bgBase,
  },
  mapContainer: {
    flex: 1.1,
    position: 'relative',
  },
  mapHeaderOverlay: {
    position: 'absolute',
    top: 54,
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 10,
  },
  hazardPinBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accentRed,
  },
  hazardPinText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.accentRed,
    letterSpacing: 0.5,
  },
  offlineBtn: {
    backgroundColor: 'rgba(8, 11, 20, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  offlineBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.accentCyan,
    letterSpacing: 1,
  },
  statusChip: {
    position: 'absolute',
    top: 54,
    left: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8, 11, 20, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotGreen: {
    backgroundColor: Colors.accentGreen,
  },
  dotCyan: {
    backgroundColor: Colors.accentCyan,
  },
  statusText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  telemetryContainer: {
    flex: 1.3,
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  speedometerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgElevated,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h2,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  savedBanner: {
    backgroundColor: Colors.accentGreenDim,
    borderColor: Colors.accentGreen,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  savedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveRoadBtn: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
  },
  saveRoadBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.accentCyan,
    letterSpacing: 0.5,
  },
  shareTripBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.accentGreen,
  },
  shareTripBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.accentGreen,
    letterSpacing: 0.5,
  },
  savedTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.accentGreen,
    letterSpacing: 1,
  },
  savedMeta: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: Colors.accentCyan,
  },
  stopButton: {
    backgroundColor: Colors.accentRed,
  },
  actionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.bgBase,
    letterSpacing: 1,
  },
  stopBtnText: {
    color: Colors.textPrimary,
  },
  btnPressed: {
    opacity: 0.85,
  },
  vehiclePill: {
    alignSelf: 'center',
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  vehiclePillText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
});
