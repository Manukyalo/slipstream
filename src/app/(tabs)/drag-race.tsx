/**
 * Drag Race Screen — Phase 6
 *
 * Changes from v1:
 *  - Wrapped in ScreenContainer (header clears status bar)
 *  - Horizontally scrollable filter chips with edge fade: All · 0-60 · 0-100 · 1/4 mi · 1/2 mi · 1 mi
 *  - GPS disclaimer moved into a bottom info sheet behind an "i" icon
 *  - Live result card post-run: time, reaction, 60 ft split, trap speed, peak G, PB badge
 *  - Two-column benchmark grid with best / last layout
 *  - Amber countdown useEffect drives ChristmasTree steps
 *  - All Lucide refs removed — Phosphor only via Icon wrapper
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, FontFamily, Radius, Spacing, Typography } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { ChristmasTree } from '@/components/drag/ChristmasTree';
import { useVehicles } from '@/hooks/useVehicles';
import { useDragRace, type RaceTargetMode } from '@/hooks/useDragRace';
import {
  fetchPersonalBests,
  fetchSprintPersonalBests,
  DRAG_DISTANCE_LABELS,
  SPRINT_LABELS,
  type DragDistanceType,
  type SprintType,
} from '@/services/dragRuns';
import { useAuth } from '@/contexts/AuthContext';

// ─── Mode chip definitions ────────────────────────────────────────────────────

interface ModeChip {
  id:    RaceTargetMode;
  label: string;
}

const MODE_CHIPS: ModeChip[] = [
  { id: 'all',       label: 'All' },
  { id: 'sprint_60', label: '0–60' },
  { id: 'sprint_100',label: '0–100' },
  { id: 'drag',      label: '¼ mi' },
  { id: 'half_mile', label: '½ mi' },
  { id: 'one_mile',  label: '1 mi' },
];

// ─── Amber countdown timing ───────────────────────────────────────────────────
const AMBER_INTERVAL_MS = 500; // sportsman tree: 0.5 s between each amber

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(2);
}

function formatReaction(ms: number): string {
  return (ms / 1000).toFixed(3);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DragRaceScreen({ isEmbedded = false }: { isEmbedded?: boolean } = {}) {
  const { user } = useAuth();
  const { primaryVehicle } = useVehicles();
  const insets = useSafeAreaInsets();

  const {
    status,
    elapsedMs,
    currentSpeedKmh,
    distanceTraveledMeters,
    topSpeedKmh,
    peakG,
    gForceMagnitude,
    reactionTimeMs,
    isFoul,
    splits,
    sprints,
    mode,
    setMode,
    stageVehicle,
    abortRun,
    resetTimer,
    manualLaunch,
  } = useDragRace();

  // Amber countdown state (driven here, passed to tree)
  const [countdownStep, setCountdownStep] = useState<number>(0);
  const amberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // GPS info sheet visibility
  const [showGpsInfo, setShowGpsInfo] = useState(false);

  // Persisted personal-best records
  const [pbSplits, setPbSplits] = useState<Record<DragDistanceType, { elapsed_ms: number } | null>>({
    quarter_mile: null,
    half_mile:    null,
    one_mile:     null,
  });
  const [pbSprints, setPbSprints] = useState<Record<SprintType, { elapsed_ms: number } | null>>({
    zero_to_60:  null,
    zero_to_100: null,
  });

  // ── Load personal bests when user is available ──────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    fetchPersonalBests(user.id, primaryVehicle?.id).then((bests) => {
      if (!cancelled) setPbSplits(bests);
    }).catch(() => undefined);

    fetchSprintPersonalBests(user.id, primaryVehicle?.id).then((bests) => {
      if (!cancelled) setPbSprints(bests);
    }).catch(() => undefined);

    return () => { cancelled = true; };
  }, [user, primaryVehicle]);

  // Refresh PBs after a run finishes
  useEffect(() => {
    if (status === 'finished' && user) {
      fetchPersonalBests(user.id, primaryVehicle?.id).then(setPbSplits).catch(() => undefined);
      fetchSprintPersonalBests(user.id, primaryVehicle?.id).then(setPbSprints).catch(() => undefined);
    }
  }, [status, user, primaryVehicle]);

  // ── Amber countdown: fires 0.5 s per step after staged ──────────────────
  useEffect(() => {
    if (status !== 'staged') {
      if (amberTimerRef.current) {
        clearTimeout(amberTimerRef.current);
        amberTimerRef.current = null;
      }
      return;
    }

    let step = 0;

    function fireNext() {
      step += 1;
      setCountdownStep(step);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

      if (step < 3) {
        amberTimerRef.current = setTimeout(fireNext, AMBER_INTERVAL_MS);
      }
      // Step 3 = all amber lit; green fires when the car launches
    }

    amberTimerRef.current = setTimeout(fireNext, AMBER_INTERVAL_MS);

    return () => {
      if (amberTimerRef.current) {
        clearTimeout(amberTimerRef.current);
        amberTimerRef.current = null;
      }
    };
  }, [status]);

  const disabled = status === 'running' || status === 'staging';
  const isFinished = status === 'finished' || status === 'foul';
  const activeCountdown = status === 'staged' ? countdownStep : 0;

  // ── Determine PB badge eligibility ────────────────────────────────────────
  function isPBSplit(type: DragDistanceType): boolean {
    const run = splits[type];
    const pb  = pbSplits[type];
    if (!run) return false;
    if (!pb)  return true; // first ever run = PB
    return run.elapsedMs <= pb.elapsed_ms;
  }

  function isPBSprint(type: SprintType): boolean {
    const run = sprints[type];
    const pb  = pbSprints[type];
    if (!run) return false;
    if (!pb)  return true;
    return run.elapsedMs <= pb.elapsed_ms;
  }

  const quarter = splits.quarter_mile;
  const sixtyFtMs = quarter
    ? Math.round(quarter.elapsedMs * (18.288 / 402.336)) // interpolate 60 ft from quarter
    : null;

  // ── Handle stage ──────────────────────────────────────────────────────────
  const handleStage = useCallback(() => {
    setCountdownStep(0);
    stageVehicle().catch((err) => console.error('[DragRace] stageVehicle:', err));
  }, [stageVehicle]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
    <ScreenContainer
      title="Drag"
      skipTopInset={isEmbedded}
      headerRight={
        <Pressable
          onPress={() => setShowGpsInfo(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="GPS accuracy information"
          accessibilityRole="button"
          style={styles.infoBtn}
        >
          <Icon name="info" size={18} color={Colors.text.tertiary} weight="regular" />
        </Pressable>
      }
      scrollable
      scrollViewProps={{
        showsVerticalScrollIndicator: false,
      }}
      contentStyle={{ paddingHorizontal: Spacing.screen, gap: Spacing.gap }}
    >
      {/* ── Vehicle chip ─────────────────────────────────────────────────── */}
      {primaryVehicle && (
        <View style={styles.vehicleChip}>
          <Icon name="car" size={12} color={Colors.text.tertiary} weight="regular" />
          <Text variant="label" color={Colors.text.secondary} numberOfLines={1} style={styles.vehicleChipText}>
            {primaryVehicle.year} {primaryVehicle.make} {primaryVehicle.model}
          </Text>
        </View>
      )}

      {/* ── Mode filter chips — horizontally scrollable with fade ─────────── */}
      <View style={styles.chipRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScrollContent}
        >
          {MODE_CHIPS.map((chip) => {
            const active = mode === chip.id;
            return (
              <Pressable
                key={chip.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  if (!disabled) {
                    setMode(chip.id);
                    Haptics.selectionAsync().catch(() => undefined);
                  }
                }}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text
                  variant="label"
                  color={active ? Colors.accent.cyan : Colors.text.tertiary}
                  style={active ? styles.chipLabelActive : undefined}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {/* Right fade edge */}
        <LinearGradient
          colors={['rgba(5, 7, 13, 0)', Colors.bg.base]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.chipFadeRight}
          pointerEvents="none"
        />
      </View>

      {/* ── Christmas tree ────────────────────────────────────────────────── */}
      <View style={styles.treeSection}>
        <ChristmasTree
          status={status}
          isFoul={isFoul}
          countdownStep={activeCountdown}
        />
      </View>

      {/* ── Hero timer + telemetry row ────────────────────────────────────── */}
      <View style={styles.heroSection}>
        <Text
          variant="metricXL"
          color={
            status === 'running'
              ? Colors.semantic.warning
              : status === 'foul'
              ? Colors.semantic.danger
              : Colors.text.primary
          }
          tabular
          centered
          style={styles.heroTimer}
        >
          {formatTime(elapsedMs)}
        </Text>
        <Text variant="label" color={Colors.text.tertiary} centered>
          {status === 'running' ? 'Elapsed — s' : status === 'foul' ? 'Foul start' : 'seconds'}
        </Text>

        {/* Live telemetry pill */}
        <View style={styles.telemetryPill}>
          <TelemetryStat value={Math.round(currentSpeedKmh).toString()} unit="km/h" />
          <View style={styles.pillDivider} />
          <TelemetryStat value={gForceMagnitude.toFixed(2)} unit="G" />
          <View style={styles.pillDivider} />
          <TelemetryStat value={Math.round(distanceTraveledMeters).toString()} unit="m" />
        </View>
      </View>

      {/* ── Result card — shown after run completes ───────────────────────── */}
      {isFinished && (quarter || sprints.zero_to_60 || sprints.zero_to_100) && (
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text variant="overline" color={Colors.text.tertiary}>Run result</Text>
            {(isPBSplit('quarter_mile') || isPBSprint('zero_to_60') || isPBSprint('zero_to_100')) && (
              <View style={styles.pbBadge}>
                <Icon name="trophy" size={11} color={Colors.semantic.success} weight="fill" />
                <Text variant="label" color={Colors.semantic.success} style={styles.pbBadgeText}>
                  PB
                </Text>
              </View>
            )}
          </View>

          <View style={styles.resultGrid}>
            {/* Primary time */}
            <ResultCell
              label="Time"
              value={formatTime(elapsedMs)}
              unit="s"
              highlight
            />

            {/* Reaction time */}
            {reactionTimeMs !== null && (
              <ResultCell
                label="Reaction"
                value={formatReaction(reactionTimeMs)}
                unit="s"
              />
            )}

            {/* 60 ft */}
            {sixtyFtMs !== null && (
              <ResultCell
                label="60 ft"
                value={formatTime(sixtyFtMs)}
                unit="s"
              />
            )}

            {/* Trap speed */}
            {quarter && (
              <ResultCell
                label="Trap speed"
                value={Math.round(quarter.trapSpeedKmh).toString()}
                unit="km/h"
              />
            )}
            {sprints.zero_to_60 && !quarter && (
              <ResultCell
                label="Trap speed"
                value={Math.round(sprints.zero_to_60.trapSpeedKmh).toString()}
                unit="km/h"
              />
            )}

            {/* Peak G */}
            {peakG > 0 && (
              <ResultCell
                label="Peak G"
                value={peakG.toFixed(2)}
                unit="G"
              />
            )}

            {/* Top speed */}
            {topSpeedKmh > 0 && (
              <ResultCell
                label="Top speed"
                value={Math.round(topSpeedKmh).toString()}
                unit="km/h"
              />
            )}
          </View>
        </Card>
      )}

      {/* ── Benchmark splits grid ─────────────────────────────────────────── */}
      <View style={styles.benchmarkSection}>
        <Text variant="overline" color={Colors.text.tertiary}>Benchmarks</Text>
        <View style={styles.benchmarkGrid}>
          {/* Sprint benchmarks */}
          {(['zero_to_60', 'zero_to_100'] as SprintType[]).map((type) => {
            const run = sprints[type];
            const isPB = isPBSprint(type);
            return (
              <BenchmarkCell
                key={type}
                label={SPRINT_LABELS[type]}
                timeMs={run?.elapsedMs ?? null}
                trapSpeed={run?.trapSpeedKmh ?? null}
                isPB={isPB}
              />
            );
          })}
          {/* Distance splits */}
          {(['quarter_mile', 'half_mile', 'one_mile'] as DragDistanceType[]).map((type) => {
            const run = splits[type];
            const isPB = isPBSplit(type);
            return (
              <BenchmarkCell
                key={type}
                label={DRAG_DISTANCE_LABELS[type]}
                timeMs={run?.elapsedMs ?? null}
                trapSpeed={run?.trapSpeedKmh ?? null}
                isPB={isPB}
              />
            );
          })}
        </View>
      </View>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <View style={[styles.actionRow, { paddingBottom: insets.bottom + Spacing[4] }]}>
        {(status === 'idle' || status === 'finished' || status === 'foul') && (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={handleStage}
            accessibilityRole="button"
            accessibilityLabel="Stage vehicle"
          >
            <Text variant="label" color="#05070D" style={styles.primaryBtnText}>
              Stage vehicle
            </Text>
          </Pressable>
        )}

        {status === 'staged' && (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => manualLaunch()}
            accessibilityRole="button"
            accessibilityLabel="Launch now"
          >
            <Text variant="label" color="#05070D" style={styles.primaryBtnText}>
              Launch now
            </Text>
          </Pressable>
        )}

        {(status === 'staging' || status === 'running') && (
          <Pressable
            style={({ pressed }) => [styles.abortBtn, pressed && styles.pressed]}
            onPress={abortRun}
            accessibilityRole="button"
            accessibilityLabel="Abort run"
          >
            <Text variant="label" color={Colors.semantic.danger}>
              Abort run
            </Text>
          </Pressable>
        )}

        {isFinished && (
          <Pressable
            style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}
            onPress={resetTimer}
            accessibilityRole="button"
            accessibilityLabel="Reset"
          >
            <Icon name="refresh" size={14} color={Colors.text.tertiary} weight="regular" />
            <Text variant="label" color={Colors.text.tertiary} style={{ marginLeft: 6 }}>
              Reset
            </Text>
          </Pressable>
        )}
      </View>
    </ScreenContainer>

    {/* ── GPS Info Sheet */}
    <GpsInfoSheet visible={showGpsInfo} onClose={() => setShowGpsInfo(false)} />
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TelemetryStat({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.telemetryStat}>
      <Text variant="label" color={Colors.text.primary} tabular style={styles.telemetryVal}>
        {value}
      </Text>
      <Text variant="label" color={Colors.text.tertiary} style={styles.telemetryUnit}>
        {unit}
      </Text>
    </View>
  );
}

function ResultCell({
  label,
  value,
  unit,
  highlight = false,
}: {
  label:     string;
  value:     string;
  unit:      string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.resultCell}>
      <Text variant="label" color={Colors.text.tertiary}>{label}</Text>
      <View style={styles.resultCellValue}>
        <Text
          variant={highlight ? 'metricL' : 'heading'}
          color={highlight ? Colors.semantic.warning : Colors.text.primary}
          tabular
        >
          {value}
        </Text>
        <Text variant="label" color={Colors.text.tertiary} style={{ marginLeft: 3 }}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

function BenchmarkCell({
  label,
  timeMs,
  trapSpeed,
  isPB,
}: {
  label:     string;
  timeMs:    number | null;
  trapSpeed: number | null;
  isPB:      boolean;
}) {
  return (
    <View style={styles.benchmarkCell}>
      <View style={styles.benchmarkLabelRow}>
        <Text variant="overline" color={Colors.text.tertiary} style={styles.benchmarkLabel}>
          {label}
        </Text>
        {isPB && timeMs !== null && (
          <Icon name="seal-check" size={12} color={Colors.semantic.success} weight="fill" />
        )}
      </View>
      <Text
        variant="metricL"
        color={timeMs !== null ? Colors.semantic.warning : Colors.text.tertiary}
        tabular
        style={styles.benchmarkTime}
      >
        {timeMs !== null ? formatTime(timeMs) : '--'}
      </Text>
      {trapSpeed !== null && (
        <Text variant="label" color={Colors.text.tertiary}>
          {Math.round(trapSpeed)} km/h trap
        </Text>
      )}
    </View>
  );
}

function GpsInfoSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing[4] }]}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeader}>
          <Icon name="info" size={20} color={Colors.accent.cyan} weight="duotone" />
          <Text variant="heading" color={Colors.text.primary} style={{ marginLeft: Spacing.gap }}>
            GPS accuracy
          </Text>
        </View>

        <Text variant="body" color={Colors.text.secondary} style={styles.sheetBody}>
          Timing is estimated from GPS position updates at 1–10 Hz depending on device and conditions.
          Accuracy is typically ±0.05–0.5 s for quarter-mile runs.
        </Text>
        <Text variant="body" color={Colors.text.secondary} style={styles.sheetBody}>
          Results are for <Text variant="label" color={Colors.text.primary}>personal benchmarking only</Text>{' '}
          and are not certified for competition or insurance purposes.
        </Text>
        <Text variant="body" color={Colors.semantic.danger} style={[styles.sheetBody, styles.sheetWarning]}>
          Only use on a legally closed road or private track. Never on public roads.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.sheetClose, pressed && styles.pressed]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close info sheet"
        >
          <Text variant="label" color={Colors.bg.base}>Got it</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Vehicle chip
  vehicleChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.gap,
    alignSelf:       'flex-start',
    backgroundColor: Colors.surface['1'],
    borderRadius:    Radius.pill,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:    1,
    borderColor:    Colors.hairline,
  },
  vehicleChipText: {
    maxWidth: 200,
  },

  // Mode chips
  chipRow: {
    position: 'relative',
  },
  chipScrollContent: {
    flexDirection: 'row',
    gap:           Spacing.gap,
    paddingRight:  Spacing.section, // ensures last chip visible before fade
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderRadius:      Radius.pill,
    borderWidth:       1,
    borderColor:       Colors.hairline,
    backgroundColor:   Colors.surface['1'],
  },
  chipActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor:     Colors.accent.cyan,
  },
  chipLabelActive: {
    fontFamily: FontFamily.label,
  },
  chipFadeRight: {
    position:        'absolute',
    top:             0,
    right:           0,
    bottom:          0,
    width:           40,
  },

  // Tree section
  treeSection: {
    alignItems: 'center',
    marginVertical: Spacing.gap,
  },

  // Hero timer
  heroSection: {
    alignItems: 'center',
    gap:        Spacing[2],
  },
  heroTimer: {
    ...Typography.metricXL,
    fontSize:    80,
    lineHeight:  80,
  },
  telemetryPill: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: Colors.surface['1'],
    borderRadius:    Radius.pill,
    borderWidth:     1,
    borderColor:     Colors.hairline,
    paddingVertical: 8,
    paddingHorizontal: Spacing[4],
    gap:             Spacing[4],
    marginTop:       Spacing[2],
  },
  telemetryStat: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           3,
  },
  telemetryVal: {
    fontSize:   15,
    lineHeight: 18,
  },
  telemetryUnit: {
    fontSize: 11,
  },
  pillDivider: {
    width:           1,
    height:          14,
    backgroundColor: Colors.hairline,
  },

  // Result card
  resultCard: {
    gap: Spacing.gap,
  },
  resultHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  pbBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius:    Radius.pill,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderWidth:     1,
    borderColor:     'rgba(34,197,94,0.25)',
  },
  pbBadgeText: {
    fontSize:   11,
    lineHeight: 14,
    fontFamily: FontFamily.overline,
    letterSpacing: 0.8,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.gap,
    marginTop:     Spacing[2],
  },
  resultCell: {
    flexBasis:  '45%',
    flexGrow:   1,
    gap:        2,
  },
  resultCellValue: {
    flexDirection: 'row',
    alignItems:    'baseline',
  },

  // Benchmarks
  benchmarkSection: {
    gap: Spacing.gap,
  },
  benchmarkGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.gap,
  },
  benchmarkCell: {
    flexBasis:       '46%',
    flexGrow:        1,
    backgroundColor: Colors.surface['1'],
    borderRadius:    Radius.iconChip,
    borderWidth:     1,
    borderColor:     Colors.hairline,
    padding:         Spacing.card,
    gap:             4,
  },
  benchmarkLabelRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  benchmarkLabel: {
    flexShrink: 1,
  },
  benchmarkTime: {
    fontSize:   28,
    lineHeight: 32,
  },

  // Action buttons
  actionRow: {
    gap: Spacing[2],
  },
  primaryBtn: {
    backgroundColor: Colors.semantic.warning,
    paddingVertical: 15,
    borderRadius:    Radius.button,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.label,
    fontSize:   15,
    letterSpacing: 0.2,
  },
  abortBtn: {
    borderWidth:     1,
    borderColor:     Colors.semantic.danger,
    backgroundColor: 'rgba(244,63,94,0.08)',
    paddingVertical: 15,
    borderRadius:    Radius.button,
    alignItems:      'center',
  },
  resetBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.8,
  },

  // GPS info sheet
  infoBtn: {
    padding: 4,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    backgroundColor: Colors.surface['2'],
    borderTopLeftRadius:  Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingHorizontal: Spacing.screen,
    paddingTop:        Spacing[3],
    borderTopWidth:    1,
    borderTopColor:    Colors.hairline,
    gap:               Spacing.gap,
  },
  sheetHandle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.hairline,
    alignSelf:       'center',
    marginBottom:    Spacing[2],
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  sheetBody: {
    lineHeight: 22,
  },
  sheetWarning: {
    padding:         Spacing.gap,
    backgroundColor: 'rgba(244,63,94,0.08)',
    borderRadius:    Radius.sm,
    borderWidth:     1,
    borderColor:     'rgba(244,63,94,0.20)',
    overflow:        'hidden',
  },
  sheetClose: {
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 14,
    borderRadius:    Radius.button,
    alignItems:      'center',
    marginTop:       Spacing[2],
  },
});
