import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RotateCcw, Car } from 'lucide-react-native';
import { Theme, HeroStat } from '@/constants/theme';
import { useVehicles } from '@/hooks/useVehicles';
import { useDragRace } from '@/hooks/useDragRace';
import { ChristmasTree } from '@/components/drag/ChristmasTree';

export default function DragRaceScreen() {
  const { primaryVehicle } = useVehicles();
  const {
    status,
    elapsedMs,
    currentSpeedKmh,
    distanceTraveledMeters,
    splits,
    sprints,
    mode,
    setMode,
    gForceMagnitude,
    stageVehicle,
    abortRun,
    resetTimer,
    manualLaunch,
  } = useDragRace();

  const formattedTimer = (elapsedMs / 1000).toFixed(2);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Drag telemetry</Text>
          <Text style={styles.subtitle}>Quarter, half & full mile benchmarks</Text>
        </View>

        {primaryVehicle ? (
          <View style={styles.vehicleChip}>
            <Car size={13} strokeWidth={1.5} color={Theme.colors.textMuted} />
            <Text style={styles.vehicleChipText} numberOfLines={1}>
              {primaryVehicle.year} {primaryVehicle.make} {primaryVehicle.model}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Target Mode Selector Tabs */}
      <View style={styles.modeSelector}>
        {(
          [
            { id: 'all', label: 'All benchmarks' },
            { id: 'sprint_60', label: '0–60 mph' },
            { id: 'sprint_100', label: '0–100 km/h' },
            { id: 'drag', label: '1/4 mile' },
          ] as const
        ).map((item) => {
          const isActive = mode === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.modeTab, isActive && styles.modeTabActive]}
              onPress={() => setMode(item.id)}
              disabled={status === 'running' || status === 'staging'}
            >
              <Text style={[styles.modeTabText, isActive && styles.modeTabTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Accuracy note as quiet text-muted caption beneath tabs */}
      <Text style={styles.captionNote}>
        GPS-estimated timing (~1–10Hz). Non-certified; intended for personal benchmarking.
      </Text>

      {/* Christmas Tree (no card wrapper, clean SVG) */}
      <ChristmasTree status={status} />

      {/* Hero Timer: primary number on the void */}
      <View style={styles.heroTimerSection}>
        <HeroStat
          value={formattedTimer}
          unit="s"
          label={status === 'running' ? 'Elapsed time' : 'Ready'}
          accentColor={status === 'running' ? Theme.colors.ignitionAmber : Theme.colors.textPrimary}
          size="hero"
        />

        <View style={styles.telemetryQuickRow}>
          <View style={styles.quickStat}>
            <Text style={styles.quickStatVal}>{Math.round(currentSpeedKmh)}</Text>
            <Text style={styles.quickStatUnit}>km/h</Text>
          </View>
          <View style={styles.quickDivider} />
          <View style={styles.quickStat}>
            <Text style={styles.quickStatVal}>{gForceMagnitude.toFixed(2)}</Text>
            <Text style={styles.quickStatUnit}>G</Text>
          </View>
          <View style={styles.quickDivider} />
          <View style={styles.quickStat}>
            <Text style={styles.quickStatVal}>{Math.round(distanceTraveledMeters)}</Text>
            <Text style={styles.quickStatUnit}>m</Text>
          </View>
        </View>
      </View>

      {/* Benchmarks Section: converted to HeroStat rows without per-benchmark card wrappers */}
      <View style={styles.benchmarksSection}>
        <Text style={styles.sectionHeader}>Benchmarks</Text>

        <View style={styles.benchmarksGrid}>
          {/* 0-60 mph */}
          <View style={styles.benchmarkItem}>
            <Text style={styles.benchmarkLabel}>0–60 mph</Text>
            <HeroStat
              value={sprints.zero_to_60 ? (sprints.zero_to_60.elapsedMs / 1000).toFixed(2) : '--'}
              unit="s"
              size="large"
              accentColor={sprints.zero_to_60 ? Theme.colors.ignitionAmber : Theme.colors.textMuted}
            />
          </View>

          {/* 0-100 km/h */}
          <View style={styles.benchmarkItem}>
            <Text style={styles.benchmarkLabel}>0–100 km/h</Text>
            <HeroStat
              value={sprints.zero_to_100 ? (sprints.zero_to_100.elapsedMs / 1000).toFixed(2) : '--'}
              unit="s"
              size="large"
              accentColor={sprints.zero_to_100 ? Theme.colors.ignitionAmber : Theme.colors.textMuted}
            />
          </View>

          {/* 1/4 mile */}
          <View style={styles.benchmarkItem}>
            <Text style={styles.benchmarkLabel}>1/4 mile</Text>
            <HeroStat
              value={splits.quarter_mile ? (splits.quarter_mile.elapsedMs / 1000).toFixed(2) : '--'}
              unit="s"
              size="large"
              accentColor={splits.quarter_mile ? Theme.colors.ignitionAmber : Theme.colors.textMuted}
            />
            {splits.quarter_mile && (
              <Text style={styles.trapSpeedCaption}>
                Trap: {Math.round(splits.quarter_mile.trapSpeedKmh)} km/h
              </Text>
            )}
          </View>

          {/* 1/2 mile */}
          <View style={styles.benchmarkItem}>
            <Text style={styles.benchmarkLabel}>1/2 mile</Text>
            <HeroStat
              value={splits.half_mile ? (splits.half_mile.elapsedMs / 1000).toFixed(2) : '--'}
              unit="s"
              size="large"
              accentColor={splits.half_mile ? Theme.colors.ignitionAmber : Theme.colors.textMuted}
            />
            {splits.half_mile && (
              <Text style={styles.trapSpeedCaption}>
                Trap: {Math.round(splits.half_mile.trapSpeedKmh)} km/h
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Primary Action Button: ignition-amber flat-fill, Inter medium, sentence case */}
      <View style={styles.actionRow}>
        {status === 'idle' || status === 'finished' ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={stageVehicle}
          >
            <Text style={styles.primaryBtnText}>Stage vehicle</Text>
          </Pressable>
        ) : status === 'staged' ? (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={manualLaunch}
          >
            <Text style={styles.primaryBtnText}>Launch now</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.abortBtn, pressed && styles.pressed]}
            onPress={abortRun}
          >
            <Text style={styles.abortBtnText}>Abort run</Text>
          </Pressable>
        )}

        {status === 'finished' && (
          <Pressable
            style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
            onPress={resetTimer}
          >
            <RotateCcw size={15} strokeWidth={1.5} color={Theme.colors.textMuted} />
            <Text style={styles.resetBtnText}>Reset</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.bgVoid,
  },
  contentContainer: {
    paddingTop: 54,
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: Theme.spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontFamily: Theme.fonts.numberBold,
    fontSize: 24,
    color: Theme.colors.textPrimary,
  },
  subtitle: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 13,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  vehicleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.colors.surfaceRaised,
    borderRadius: Theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceBorder,
    maxWidth: '45%',
  },
  vehicleChipText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: Theme.colors.textSecondary,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.surface,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceBorder,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Theme.radius.xs,
  },
  modeTabActive: {
    backgroundColor: Theme.colors.surfaceRaised,
  },
  modeTabText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.textMuted,
  },
  modeTabTextActive: {
    color: Theme.colors.signalCyan,
  },
  captionNote: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  heroTimerSection: {
    alignItems: 'center',
    marginVertical: Theme.spacing.base,
  },
  telemetryQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.base,
    marginTop: Theme.spacing.md,
    backgroundColor: Theme.colors.surface,
    paddingVertical: 8,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.radius.full,
    borderWidth: 1,
    borderColor: Theme.colors.surfaceBorder,
  },
  quickStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  quickStatVal: {
    fontFamily: Theme.fonts.numberSemiBold,
    fontVariant: ['tabular-nums'],
    fontSize: 15,
    color: Theme.colors.textPrimary,
  },
  quickStatUnit: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 10,
    color: Theme.colors.textMuted,
  },
  quickDivider: {
    width: 1,
    height: 12,
    backgroundColor: Theme.colors.hairline,
  },
  benchmarksSection: {
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
  },
  sectionHeader: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Theme.spacing.md,
  },
  benchmarksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  benchmarkItem: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.hairline,
  },
  benchmarkLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 12,
    color: Theme.colors.textMuted,
    marginBottom: 4,
  },
  trapSpeedCaption: {
    fontFamily: Theme.fonts.bodyRegular,
    fontSize: 11,
    color: Theme.colors.textMuted,
    marginTop: 2,
  },
  actionRow: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  primaryBtn: {
    backgroundColor: Theme.colors.ignitionAmber,
    paddingVertical: 15,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 15,
    color: Theme.colors.textInverse,
  },
  abortBtn: {
    backgroundColor: Theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: Theme.colors.flagRed,
    paddingVertical: 15,
    borderRadius: Theme.radius.md,
    alignItems: 'center',
  },
  abortBtnText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 15,
    color: Theme.colors.flagRed,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  resetBtnText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.textMuted,
  },
  pressed: {
    opacity: 0.82,
  },
});
