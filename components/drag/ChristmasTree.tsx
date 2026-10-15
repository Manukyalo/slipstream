/**
 * ChristmasTree — Drag-strip staging tree (Phase 6)
 *
 * Layout (top → bottom):
 *   Pre-stage bulbs  (blue, small)      ← lights when status >= staging
 *   Stage bulbs      (amber, small)     ← lights when status >= staged
 *   Amber 1          (large)            ← sequential countdown
 *   Amber 2          (large)
 *   Amber 3          (large)
 *   Green            (large)            ← GO — status = running
 *   Red              (large)            ← FOUL
 *
 * Haptic tick fires on each bulb transition.
 * Amber countdown: 3 bulbs flash in 0.5 s intervals (sportsman tree).
 * Props:
 *   status        — from useDragRace
 *   isFoul        — foul start flag
 *   countdownStep — which amber step [0-3] the parent is broadcasting
 *                   (driven by a useEffect in the parent after staged state)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import type { DragRaceStatus } from '@/hooks/useDragRace';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChristmasTreeProps {
  status: DragRaceStatus;
  isFoul?: boolean;
  /** 0 = all off, 1 = amber1, 2 = amber1+2, 3 = all amber */
  countdownStep?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRE_STAGE_BLUE  = '#3B82F6';
const STAGE_AMBER     = '#F59E0B';
const GO_GREEN        = '#22C55E';
const FOUL_RED        = '#F43F5E';
const DIM             = '#0D1219';
const DIM_BORDER      = '#1E2A35';
const MAST_COLOR      = '#1A2535';
const BAR_COLOR       = '#1E2A35';

const SVG_W = 140;
const SVG_H = 320;

// Y positions for each row
const ROW_PRE_STAGE = 24;
const ROW_STAGE     = 64;
const ROW_AMBER_1   = 116;
const ROW_AMBER_2   = 170;
const ROW_AMBER_3   = 224;
const ROW_GREEN     = 278;
// Red overlaps green on the same row in a real tree but we put it alongside
// the status text; no separate bulb needed — we tint the green row red on foul.

// Horizontal center of mast
const CX = SVG_W / 2;
const SMALL_R = 8;
const LARGE_R = 16;

// ─── Component ───────────────────────────────────────────────────────────────

export function ChristmasTree({
  status,
  isFoul = false,
  countdownStep = 0,
}: ChristmasTreeProps) {
  const [glowAnim] = useState(() => new Animated.Value(0));
  const prevStepRef = useRef<number>(-1);

  const isPreStaged = status === 'staging' || status === 'staged' || status === 'running' || status === 'finished' || status === 'foul';
  const isStaged    = status === 'staged'  || status === 'running' || status === 'finished' || status === 'foul';
  const isGreen     = (status === 'running' || status === 'finished') && !isFoul;
  const isRed       = isFoul || status === 'foul';

  const amber1 = isStaged && (countdownStep >= 1 || isGreen || isRed);
  const amber2 = isStaged && (countdownStep >= 2 || isGreen || isRed);
  const amber3 = isStaged && (countdownStep >= 3 || isGreen || isRed);

  const triggerGlow = useCallback((_color: string) => {
    glowAnim.setValue(1);
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [glowAnim]);

  // Haptic tick + glow pulse on each amber step and on green/red
  useEffect(() => {
    if (countdownStep > prevStepRef.current && countdownStep > 0) {
      prevStepRef.current = countdownStep;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      triggerGlow(STAGE_AMBER);
    }
  }, [countdownStep, triggerGlow]);

  useEffect(() => {
    if (isGreen) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      triggerGlow(GO_GREEN);
    }
  }, [isGreen, triggerGlow]);

  useEffect(() => {
    if (isRed) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      triggerGlow(FOUL_RED);
    }
  }, [isRed, triggerGlow]);

  useEffect(() => {
    if (status === 'staging') {
      prevStepRef.current = 0;
    }
  }, [status]);

  // Dynamic glow tint overlay
  const glowOpacity = useMemo(() => glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.28],
  }), [glowAnim]);

  const statusLabel = ((): string => {
    if (status === 'idle')    return 'Ready to stage';
    if (status === 'staging') return 'Calibrating sensors\u2026';
    if (status === 'staged')  return countdownStep === 0 ? 'Hold steady' : `Amber ${countdownStep} of 3`;
    if (status === 'running') return 'Full throttle';
    if (status === 'foul' || isFoul) return 'Foul start';
    return 'Run complete';
  })();

  const statusColor = isRed
    ? FOUL_RED
    : isGreen
    ? GO_GREEN
    : isStaged && countdownStep > 0
    ? STAGE_AMBER
    : Colors.text.secondary;

  return (
    <View style={styles.container}>
      {/* Glow overlay */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity:          glowOpacity,
            backgroundColor:  isRed ? FOUL_RED : isGreen ? GO_GREEN : STAGE_AMBER,
            borderRadius:     20,
          },
        ]}
        pointerEvents="none"
      />

      {/* SVG Tree */}
      <Svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        <Defs>
          {/* Radial gradients for large lit bulbs */}
          <RadialGradient id="green_glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#86EFAC" stopOpacity="1" />
            <Stop offset="100%" stopColor={GO_GREEN} stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="amber_glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#FDE68A" stopOpacity="1" />
            <Stop offset="100%" stopColor={STAGE_AMBER} stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="red_glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#FDA4AF" stopOpacity="1" />
            <Stop offset="100%" stopColor={FOUL_RED} stopOpacity="1" />
          </RadialGradient>
          <RadialGradient id="blue_glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%"   stopColor="#BAE6FD" stopOpacity="1" />
            <Stop offset="100%" stopColor={PRE_STAGE_BLUE} stopOpacity="1" />
          </RadialGradient>
        </Defs>

        {/* ── Mast ── */}
        <Rect x={CX - 3} y={8} width={6} height={SVG_H - 16} fill={MAST_COLOR} rx={3} />

        {/* ── Crossbars ── */}
        {[ROW_PRE_STAGE, ROW_STAGE, ROW_AMBER_1, ROW_AMBER_2, ROW_AMBER_3, ROW_GREEN].map((y) => (
          <Line key={y} x1={20} y1={y} x2={SVG_W - 20} y2={y} stroke={BAR_COLOR} strokeWidth={2} />
        ))}

        {/* ── Pre-stage bulbs (blue, small) ── */}
        {[-1, 1].map((side) => (
          <Circle
            key={`pre_${side}`}
            cx={CX + side * 26}
            cy={ROW_PRE_STAGE}
            r={SMALL_R}
            fill={isPreStaged ? 'url(#blue_glow)' : DIM}
            stroke={isPreStaged ? PRE_STAGE_BLUE : DIM_BORDER}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Stage bulbs (amber, small) ── */}
        {[-1, 1].map((side) => (
          <Circle
            key={`stage_${side}`}
            cx={CX + side * 26}
            cy={ROW_STAGE}
            r={SMALL_R}
            fill={isStaged ? 'url(#amber_glow)' : DIM}
            stroke={isStaged ? STAGE_AMBER : DIM_BORDER}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Amber 1 ── */}
        {[-1, 1].map((side) => (
          <Circle
            key={`a1_${side}`}
            cx={CX + side * 34}
            cy={ROW_AMBER_1}
            r={LARGE_R}
            fill={amber1 ? 'url(#amber_glow)' : DIM}
            stroke={amber1 ? STAGE_AMBER : DIM_BORDER}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Amber 2 ── */}
        {[-1, 1].map((side) => (
          <Circle
            key={`a2_${side}`}
            cx={CX + side * 34}
            cy={ROW_AMBER_2}
            r={LARGE_R}
            fill={amber2 ? 'url(#amber_glow)' : DIM}
            stroke={amber2 ? STAGE_AMBER : DIM_BORDER}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Amber 3 ── */}
        {[-1, 1].map((side) => (
          <Circle
            key={`a3_${side}`}
            cx={CX + side * 34}
            cy={ROW_AMBER_3}
            r={LARGE_R}
            fill={amber3 ? 'url(#amber_glow)' : DIM}
            stroke={amber3 ? STAGE_AMBER : DIM_BORDER}
            strokeWidth={1.5}
          />
        ))}

        {/* ── Green / Red launch bulbs ── */}
        {[-1, 1].map((side) => (
          <Circle
            key={`go_${side}`}
            cx={CX + side * 34}
            cy={ROW_GREEN}
            r={LARGE_R}
            fill={isRed ? 'url(#red_glow)' : isGreen ? 'url(#green_glow)' : DIM}
            stroke={isRed ? FOUL_RED : isGreen ? GO_GREEN : DIM_BORDER}
            strokeWidth={1.5}
          />
        ))}
      </Svg>

      {/* Status label */}
      <Text
        style={[
          styles.statusText,
          { color: statusColor, fontFamily: FontFamily.label },
        ]}
      >
        {statusLabel}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[2],
    overflow: 'hidden',
  },
  statusText: {
    fontSize: 13,
    letterSpacing: 0.3,
    marginTop: Spacing[1],
    textAlign: 'center',
  },
});
