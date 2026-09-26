import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';
import { useVehicles } from '@/hooks/useVehicles';
import { useDragRace } from '@/hooks/useDragRace';
import { ChristmasTree } from '@/components/drag/ChristmasTree';
import { SplitTimeCard } from '@/components/drag/SplitTimeCard';
import { DRAG_DISTANCE_METERS } from '@/services/dragRuns';

export default function DragRaceScreen() {
  const { primaryVehicle } = useVehicles();
  const {
    status,
    elapsedMs,
    currentSpeedKmh,
    distanceTraveledMeters,
    topSpeedKmh,
    splits,
    gForceMagnitude,
    stageVehicle,
    abortRun,
    resetTimer,
    manualLaunch,
  } = useDragRace();

  const formattedTimer = (elapsedMs / 1000).toFixed(3);
  const progressRatio = Math.min(1, distanceTraveledMeters / DRAG_DISTANCE_METERS.one_mile);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Drag Race</Text>
          <Text style={styles.subtitle}>Quarter, Half & Full Mile Telemetry</Text>
        </View>

        {primaryVehicle ? (
          <View style={styles.vehicleChip}>
            <Text style={styles.vehicleChipText} numberOfLines={1}>
              🏎️ {primaryVehicle.year} {primaryVehicle.make} {primaryVehicle.model}
            </Text>
          </View>
        ) : (
          <View style={styles.noVehicleChip}>
            <Text style={styles.noVehicleText}>🏎️ Garage: No car set</Text>
          </View>
        )}
      </View>

      {/* Mandatory Accuracy Disclaimer */}
      <View style={styles.disclaimerBox}>
        <View style={styles.disclaimerHeader}>
          <Text style={styles.disclaimerIcon}>⚠️</Text>
          <Text style={styles.disclaimerTitle}>GPS-ESTIMATED · NOT CERTIFIED</Text>
        </View>
        <Text style={styles.disclaimerBody}>
          Phone GPS (~1–10Hz) provides estimated timings. Data is non-certified and intended for personal benchmarking only.
        </Text>
      </View>

      {/* Staging Christmas Tree */}
      <View style={styles.treeSection}>
        <ChristmasTree status={status} />
      </View>

      {/* Live Cockpit Digital Display */}
      <View style={styles.cockpitCard}>
        <View style={styles.cockpitRow}>
          <View style={styles.timerBlock}>
            <Text style={styles.digitalTimer}>
              {formattedTimer}
              <Text style={styles.secUnit}>s</Text>
            </Text>
            <Text style={styles.digitalTimerLabel}>ELAPSED DURATION</Text>
          </View>

          <View style={styles.speedBlock}>
            <Text style={styles.speedValue}>{currentSpeedKmh.toFixed(0)}</Text>
            <Text style={styles.speedUnit}>KM/H</Text>
          </View>
        </View>

        {/* Live G-force & Top Speed Readout */}
        <View style={styles.telemetryBar}>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryValue}>{gForceMagnitude.toFixed(2)} G</Text>
            <Text style={styles.telemetryLabel}>INSTANT ACCEL</Text>
          </View>

          <View style={styles.telemetryDivider} />

          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryValue}>{distanceTraveledMeters.toFixed(0)} m</Text>
            <Text style={styles.telemetryLabel}>DISTANCE</Text>
          </View>

          <View style={styles.telemetryDivider} />

          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryValue}>{topSpeedKmh.toFixed(0)} km/h</Text>
            <Text style={styles.telemetryLabel}>PEAK TRAP</Text>
          </View>
        </View>

        {/* Distance Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
          </View>
          <View style={styles.progressMarkers}>
            <Text style={styles.markerText}>0m</Text>
            <Text style={styles.markerText}>1/4 mi (402m)</Text>
            <Text style={styles.markerText}>1/2 mi (805m)</Text>
            <Text style={styles.markerText}>1 mi (1609m)</Text>
          </View>
        </View>
      </View>

      {/* Drag Strip Controls */}
      <View style={styles.controlsSection}>
        {status === 'idle' && (
          <Pressable
            style={({ pressed }) => [styles.stageBtn, pressed && styles.pressed]}
            onPress={stageVehicle}
          >
            <Text style={styles.stageBtnText}>STAGE VEHICLE</Text>
          </Pressable>
        )}

        {status === 'staging' && (
          <View style={styles.stagingNotice}>
            <Text style={styles.stagingNoticeText}>
              CALIBRATING SENSORS... COME TO A COMPLETE STOP
            </Text>
          </View>
        )}

        {status === 'staged' && (
          <View style={styles.stagedControls}>
            <View style={styles.readyBanner}>
              <Text style={styles.readyBannerText}>LAUNCH READY — HIT THE ACCELERATOR</Text>
            </View>

            <View style={styles.stagedButtonsRow}>
              <Pressable
                style={({ pressed }) => [styles.manualBtn, pressed && styles.pressed]}
                onPress={manualLaunch}
              >
                <Text style={styles.manualBtnText}>Manual Launch</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.abortBtn, pressed && styles.pressed]}
                onPress={abortRun}
              >
                <Text style={styles.abortBtnText}>Abort</Text>
              </Pressable>
            </View>
          </View>
        )}

        {status === 'running' && (
          <Pressable
            style={({ pressed }) => [styles.abortBtn, pressed && styles.pressed]}
            onPress={abortRun}
          >
            <Text style={styles.abortBtnText}>ABORT RUN</Text>
          </Pressable>
        )}

        {status === 'finished' && (
          <Pressable
            style={({ pressed }) => [styles.stageBtn, pressed && styles.pressed]}
            onPress={resetTimer}
          >
            <Text style={styles.stageBtnText}>NEW RUN</Text>
          </Pressable>
        )}
      </View>

      {/* Split Cards */}
      <View style={styles.splitsSection}>
        <Text style={styles.splitsSectionTitle}>TIMED DISTANCE SPLITS</Text>

        <SplitTimeCard
          distanceType="quarter_mile"
          split={splits.quarter_mile}
          targetMeters={Math.round(DRAG_DISTANCE_METERS.quarter_mile)}
        />

        <SplitTimeCard
          distanceType="half_mile"
          split={splits.half_mile}
          targetMeters={Math.round(DRAG_DISTANCE_METERS.half_mile)}
        />

        <SplitTimeCard
          distanceType="one_mile"
          split={splits.one_mile}
          targetMeters={Math.round(DRAG_DISTANCE_METERS.one_mile)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgBase,
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['4xl'],
  },
  header: {
    marginBottom: Spacing.base,
    gap: Spacing.xs,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
  vehicleChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  vehicleChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.accentCyan,
  },
  noVehicleChip: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginTop: Spacing.xs,
  },
  noVehicleText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
  },
  disclaimerBox: {
    backgroundColor: 'rgba(255, 184, 0, 0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.35)',
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  disclaimerIcon: {
    fontSize: 14,
  },
  disclaimerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFB800',
    letterSpacing: 0.5,
  },
  disclaimerBody: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  treeSection: {
    marginBottom: Spacing.base,
  },
  cockpitCard: {
    backgroundColor: Colors.bgSurface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  cockpitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  timerBlock: {
    flex: 1,
  },
  digitalTimer: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  secUnit: {
    fontSize: FontSize.h2,
    fontFamily: FontFamily.medium,
    color: Colors.accentCyan,
  },
  digitalTimerLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  speedBlock: {
    alignItems: 'flex-end',
  },
  speedValue: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    color: Colors.accentCyan,
    letterSpacing: -1,
  },
  speedUnit: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  telemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
  },
  telemetryValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.label,
    color: Colors.textPrimary,
  },
  telemetryLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  telemetryDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.borderSubtle,
  },
  progressSection: {
    paddingTop: Spacing.sm,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accentCyan,
  },
  progressMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  markerText: {
    fontFamily: FontFamily.regular,
    fontSize: 8,
    color: Colors.textMuted,
  },
  controlsSection: {
    marginBottom: Spacing.xl,
  },
  stageBtn: {
    backgroundColor: Colors.accentCyan,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.bgBase,
    letterSpacing: 1,
  },
  stagingNotice: {
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    borderColor: '#FFB800',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
  },
  stagingNoticeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: '#FFB800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  stagedControls: {
    gap: Spacing.sm,
  },
  readyBanner: {
    backgroundColor: 'rgba(0, 255, 102, 0.15)',
    borderColor: '#00FF66',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  readyBannerText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: '#00FF66',
    letterSpacing: 0.5,
  },
  stagedButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  manualBtn: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  manualBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.textPrimary,
  },
  abortBtn: {
    backgroundColor: Colors.accentRedDim,
    borderColor: Colors.accentRed,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  abortBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.accentRed,
    letterSpacing: 1,
  },
  splitsSection: {
    gap: Spacing.xs,
  },
  splitsSectionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
});
