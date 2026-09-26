import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/design';
import { useTracking } from '@/contexts/TrackingContext';
import { Speedometer } from '@/components/tracking/Speedometer';
import { SlipstreamMap } from '@/components/map/SlipstreamMap';
import { useOfflineMap } from '@/hooks/useOfflineMap';
import { useVehicles } from '@/hooks/useVehicles';
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
  const [completedMetrics, setCompletedMetrics] = useState<TripMetrics | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartStop = async () => {
    if (!permissionGranted) {
      const ok = await requestPermissions();
      if (!ok) {
        Alert.alert('Permission Required', 'Location access is required to track your route.');
        return;
      }
    }

    if (isTracking) {
      const summary = await stopTracking();
      if (summary) {
        setCompletedMetrics(summary);
      }
    } else {
      setCompletedMetrics(null);
      await startTracking();
    }
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
      {/* Map layer in top half */}
      <View style={styles.mapContainer}>
        <SlipstreamMap
          centerCoordinate={currentCoords ?? undefined}
          routeGeoJson={routeGeoJson}
          followUser={isTracking}
          zoomLevel={15}
        />

        {/* Offline map download CTA overlay */}
        <View style={styles.mapHeaderOverlay}>
          <Pressable
            style={({ pressed }) => [styles.offlineBtn, pressed && styles.btnPressed]}
            onPress={handleOfflineDownload}
            disabled={downloadState.isDownloading}
          >
            <Text style={styles.offlineBtnText}>
              {downloadState.isDownloading
                ? `DOWNLOADING ${downloadState.progressPercentage}%`
                : downloadState.completed
                ? 'OFFLINE AREA READY'
                : 'DOWNLOAD OFFLINE MAP'}
            </Text>
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
            <Text style={styles.savedTitle}>TRIP SAVED TO CLOUD</Text>
            <Text style={styles.savedMeta}>
              {(completedMetrics.distanceMeters / 1000).toFixed(2)} km · Top {completedMetrics.topSpeedKmh} km/h · Avg {completedMetrics.avgSpeedKmh} km/h
            </Text>
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
    zIndex: 10,
  },
  offlineBtn: {
    backgroundColor: 'rgba(8, 11, 20, 0.85)',
    paddingHorizontal: 12,
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
    alignItems: 'center',
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
