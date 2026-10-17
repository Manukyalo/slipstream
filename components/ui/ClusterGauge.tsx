/**
 * ClusterGauge — Digital Telemetry Cluster
 *
 * Design Architecture:
 *  - Two angular chevron bar gauges (segmented):
 *      LEFT:  Speedometer (0–260 km/h or 0–160 mph), threshold-coloured segments
 *             Digital speed readout beside the chevron; NO number in centre, NO needle
 *      RIGHT: Longitudinal G-force (Accel / Brake); NO RPM
 *      CENTRE: Primary garage vehicle photo or silhouette fallback
 *              Bottom row: GPS status chip & trip distance
 *  - Modes:
 *      'live':    Full dual-chevron cluster for Track screen
 *      'peak':    Single chevron with peak marker & single readout for Profile & Recap
 *      'compact': Scaled single or dual chevron for condensed cards / settings preview
 *  - Two gauge themes: 'slipstream' (cyan/blue) and 'sport' (red/orange/white)
 *  - Sport zones distinguished by segment colour AND thin silver bevel stroke — visible in greyscale
 *  - Theme switch: 250 ms opacity crossfade, skipped when reduceMotion is on
 *  - 60 fps transitions via Animated spring
 *  - Strictly theme tokens from GaugeThemes — zero inline hex
 *  - Idle / zero-data shows dashes ("—"), never a big 0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  View,
  StyleSheet,
  Image,
  Animated,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Polygon,
  Text as SvgText,
  G,
} from 'react-native-svg';
import { Colors, FontFamily, GaugeThemes, Radius, Spacing } from '@/constants/theme';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Icon } from './Icon';
import { Text } from './Text';

export type ClusterGaugeMode = 'live' | 'peak' | 'compact';

export interface ClusterGaugeProps {
  mode?: ClusterGaugeMode;
  speedKmh?: number;
  maxSpeedKmh?: number;
  longitudinalG?: number; // e.g. -1.0 to +1.0
  tripDistanceKm?: number;
  gpsStatus?: 'locked' | 'acquiring' | 'none';
  vehiclePhotoUrl?: string | null;
  vehicleLabel?: string;
  hasData?: boolean;
  style?: ViewStyle;
}

const TOTAL_SPEED_SEGMENTS = 20;
const DIAL_MAX_KMH = 260;
const DIAL_MAX_MPH = 160;

// Major tick speeds
const TICKS_KMH = [0, 40, 80, 120, 160, 200, 240, 260];
const TICKS_MPH = [0, 20, 40, 60, 80, 100, 120, 140, 160];

// Zone boundary indices for sport theme (greyscale accessibility)
const SPORT_ZONE_BOUNDARY_HIGH  = Math.floor(TOTAL_SPEED_SEGMENTS * 0.67); // orange starts here
const SPORT_ZONE_BOUNDARY_WHOT  = Math.floor(TOTAL_SPEED_SEGMENTS * 0.90); // white-hot starts here

interface SegmentGeometry {
  points: string;
  center: { x: number; y: number };
}

function generateChevronSegments(
  totalSegments: number,
  side: 'left' | 'right',
  width: number,
  height: number,
): SegmentGeometry[] {
  const segments: SegmentGeometry[] = [];
  const isLeft = side === 'left';

  const leftXOuter = 16;
  const rightXOuter = width - 16;

  const yTop = 18;
  const yBottom = height - 26;
  const spanY = yBottom - yTop;

  for (let i = 0; i < totalSegments; i++) {
    const t = i / (totalSegments - 1);
    const nextT = (i + 0.82) / (totalSegments - 1);

    const getPoint = (fraction: number) => {
      const y = yBottom - fraction * spanY;

      const x = isLeft
        ? leftXOuter + 14 + (fraction < 0.5 ? (1 - fraction / 0.5) * 16 : 0) + (fraction >= 0.5 ? ((fraction - 0.5) / 0.5) * 38 : 0)
        : rightXOuter - 14 - (fraction < 0.5 ? (1 - fraction / 0.5) * 16 : 0) - (fraction >= 0.5 ? ((fraction - 0.5) / 0.5) * 38 : 0);

      return { x, y };
    };

    const p1 = getPoint(t);
    const p2 = getPoint(nextT);

    const barWidth = 14;
    const slant = isLeft ? -4 : 4;

    const points = isLeft
      ? `${p1.x},${p1.y} ${p1.x + barWidth},${p1.y + slant} ${p2.x + barWidth},${p2.y + slant} ${p2.x},${p2.y}`
      : `${p1.x - barWidth},${p1.y + slant} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p2.x - barWidth},${p2.y + slant}`;

    segments.push({
      points,
      center: { x: isLeft ? p1.x + barWidth / 2 : p1.x - barWidth / 2, y: (p1.y + p2.y) / 2 },
    });
  }

  return segments;
}

/** Tiny hook — reads system reduce-motion setting reactively. */
function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  return reduceMotion;
}

export function ClusterGauge({
  mode = 'live',
  speedKmh = 0,
  maxSpeedKmh,
  longitudinalG = 0,
  tripDistanceKm,
  gpsStatus = 'locked',
  vehiclePhotoUrl,
  hasData = true,
  style,
}: ClusterGaugeProps) {
  const { speedUnit, convertSpeed, speedUnitLabel, distanceUnitLabel, gaugeTheme } = usePreferences();
  const isMph = speedUnit === 'mph';
  const isSport = gaugeTheme === 'sport';
  const theme = GaugeThemes[gaugeTheme];
  const reduceMotion = useReduceMotion();

  // ── Theme-change crossfade animation ──────────────────────────────────────
  // Dips to 0.6 opacity and returns to 1 over 250 ms when gaugeTheme changes.
  // Skipped entirely when the system reduce-motion preference is on.
  const [flashAnim] = useState(() => new Animated.Value(1));
  const prevThemeRef = useRef(gaugeTheme);
  useEffect(() => {
    if (prevThemeRef.current === gaugeTheme) return;
    prevThemeRef.current = gaugeTheme;
    if (reduceMotion) return;
    flashAnim.setValue(0.6);
    Animated.timing(flashAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [gaugeTheme, reduceMotion, flashAnim]);

  // ── Speed animation ────────────────────────────────────────────────────────
  const effectiveSpeed = convertSpeed(Math.max(0, speedKmh));
  const effectiveMaxSpeed = maxSpeedKmh ?? (isMph ? DIAL_MAX_MPH : DIAL_MAX_KMH);

  const [animSpeed] = useState(() => new Animated.Value(hasData ? effectiveSpeed : 0));
  const [displaySpeedVal, setDisplaySpeedVal] = useState<number>(effectiveSpeed);

  useEffect(() => {
    const target = hasData ? effectiveSpeed : 0;
    Animated.spring(animSpeed, {
      toValue: target,
      friction: 9,
      tension: 65,
      useNativeDriver: false,
    }).start();

    const listener = animSpeed.addListener(({ value }) => {
      setDisplaySpeedVal(Math.round(value));
    });

    return () => { animSpeed.removeListener(listener); };
  }, [effectiveSpeed, hasData, animSpeed]);

  // ── Viewport dimensions ────────────────────────────────────────────────────
  const isPeak = mode === 'peak';
  const isCompact = mode === 'compact';
  const svgWidth  = isPeak ? 300 : isCompact ? 320 : 360;
  const svgHeight = isPeak ? 130 : isCompact ? 140 : 172;

  const leftSegments = useMemo(
    () => generateChevronSegments(TOTAL_SPEED_SEGMENTS, 'left', svgWidth, svgHeight),
    [svgWidth, svgHeight],
  );
  const rightSegments = useMemo(
    () => generateChevronSegments(TOTAL_SPEED_SEGMENTS, 'right', svgWidth, svgHeight),
    [svgWidth, svgHeight],
  );

  // ── Active segment counts ──────────────────────────────────────────────────
  const activeSpeedRatio   = Math.min(1, Math.max(0, displaySpeedVal / effectiveMaxSpeed));
  const activeSegmentCount = Math.round(activeSpeedRatio * TOTAL_SPEED_SEGMENTS);

  // ── Segment colour helpers ─────────────────────────────────────────────────
  /**
   * Slipstream: cyan → blue (0–66%), amber (>120 km/h), red (>180 km/h).
   * Sport:      deep-red → bright-red (0–66%), orange (67–89%), white-hot (top 10%).
   *
   * Zone distinction in greyscale (WCAG non-colour requirement):
   *   Sport segments at zone boundaries (indices 13 and 18) carry a thin
   *   white stroke (`zoneBevel`) rendered as an SVG stroke, ensuring the
   *   zones are visually distinct without relying on colour alone.
   */
  const getSegmentColor = (index: number): string => {
    if (isSport) {
      if (index >= SPORT_ZONE_BOUNDARY_WHOT) return theme.segDanger;   // white-hot top 10%
      if (index >= SPORT_ZONE_BOUNDARY_HIGH) return theme.segHigh;     // orange 67-89%
      // deep red (0-44%) → bright red (45-66%)
      return index < Math.floor(TOTAL_SPEED_SEGMENTS * 0.45) ? theme.segLow : theme.segMid;
    }
    // Slipstream thresholds
    const segSpeed = (index / TOTAL_SPEED_SEGMENTS) * effectiveMaxSpeed;
    const warningThresh = isMph ? 75 : 120;
    const dangerThresh  = isMph ? 110 : 180;
    if (segSpeed >= dangerThresh) return theme.segDanger;
    if (segSpeed >= warningThresh) return theme.segHigh;
    return index < TOTAL_SPEED_SEGMENTS * 0.4 ? theme.segLow : theme.segMid;
  };

  /**
   * Returns true for segments at sport zone boundaries — these receive
   * the thin white `zoneBevel` stroke for greyscale accessibility.
   */
  const isSportZoneBoundary = (index: number): boolean =>
    isSport && (index === SPORT_ZONE_BOUNDARY_HIGH || index === SPORT_ZONE_BOUNDARY_WHOT);

  // ── Right chevron: G-force ─────────────────────────────────────────────────
  const clampedG  = Math.min(1.2, Math.max(-1.2, longitudinalG));
  const midIndex  = Math.floor(TOTAL_SPEED_SEGMENTS / 2);

  const isGActive = (index: number): boolean => {
    if (!hasData || Math.abs(clampedG) < 0.05) return false;
    if (clampedG > 0) {
      const targetIndex = Math.min(TOTAL_SPEED_SEGMENTS - 1, midIndex + Math.round((clampedG / 1.0) * (midIndex - 1)));
      return index >= midIndex && index <= targetIndex;
    }
    const targetIndex = Math.max(0, midIndex - Math.round((Math.abs(clampedG) / 1.0) * midIndex));
    return index <= midIndex && index >= targetIndex;
  };

  const getGColor = (): string =>
    clampedG > 0
      ? (isSport ? theme.segMid : Colors.accent.cyan)   // acceleration
      : (isSport ? theme.segHigh : Colors.semantic.warning); // braking

  // ── Display text ───────────────────────────────────────────────────────────
  const tickList = isMph ? TICKS_MPH : TICKS_KMH;
  const isIdle   = !hasData || speedKmh <= 0.5;
  const speedDisplayString = isIdle ? '—' : `${displaySpeedVal}`;

  // ─────────────────────────────────────────────────────────────────────────
  // PEAK MODE RENDER (Profile Top Speed card)
  // ─────────────────────────────────────────────────────────────────────────
  if (isPeak) {
    const peakRatio    = Math.min(1, Math.max(0, speedKmh / effectiveMaxSpeed));
    const peakSegIndex = Math.min(TOTAL_SPEED_SEGMENTS - 1, Math.max(0, Math.round(peakRatio * (TOTAL_SPEED_SEGMENTS - 1))));

    return (
      <Animated.View style={[styles.peakContainer, style, { opacity: flashAnim }]}>
        <View style={styles.peakSvgWrap}>
          <Svg width={120} height={120} viewBox="0 0 120 130">
            {leftSegments.map((seg, idx) => {
              const isFilled      = hasData && idx <= peakSegIndex;
              const isPeakMarker  = hasData && idx === peakSegIndex && peakSegIndex > 0;
              const fill          = isFilled ? getSegmentColor(idx) : theme.segUnlit;
              const opacity       = isFilled ? 1 : 0.4;
              const showBevel     = isFilled && isSportZoneBoundary(idx);

              return (
                <G key={idx}>
                  <Polygon points={seg.points} fill={fill} opacity={opacity} />
                  {showBevel && (
                    <Polygon
                      points={seg.points}
                      fill="none"
                      stroke={theme.zoneBevel}
                      strokeWidth={1.5}
                    />
                  )}
                  {isPeakMarker && (
                    <Polygon
                      points={seg.points}
                      fill={theme.peakMarker}
                      stroke={Colors.text.primary}
                      strokeWidth={1.5}
                    />
                  )}
                </G>
              );
            })}
          </Svg>
        </View>

        <View style={styles.peakInfoColumn}>
          <Text variant="label" color={Colors.text.tertiary} style={styles.peakHeaderLabel}>
            TOP SPEED
          </Text>
          <View style={styles.peakValueRow}>
            <Text
              variant="display"
              color={hasData && speedKmh > 0 ? Colors.text.primary : Colors.text.tertiary}
              tabular
              style={styles.peakSpeedValue}
            >
              {speedDisplayString}
            </Text>
            <Text variant="label" color={Colors.text.tertiary} style={styles.peakUnitText}>
              {speedUnitLabel}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIVE / COMPACT MODE RENDER (Track screen + Settings preview)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, style, { opacity: flashAnim }]}>
      <Svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
        {/* ── LEFT CHEVRON: SPEEDOMETER ── */}
        {leftSegments.map((seg, idx) => {
          const isLit     = hasData && idx < activeSegmentCount;
          const fill      = isLit ? getSegmentColor(idx) : theme.segUnlit;
          const opacity   = isLit ? 1 : 0.35;
          const showBevel = isLit && isSportZoneBoundary(idx);

          return (
            <G key={`speed-seg-${idx}`}>
              <Polygon points={seg.points} fill={fill} opacity={opacity} />
              {showBevel && (
                <Polygon
                  points={seg.points}
                  fill="none"
                  stroke={theme.zoneBevel}
                  strokeWidth={1.5}
                />
              )}
            </G>
          );
        })}

        {/* ── RIGHT CHEVRON: LONGITUDINAL G-FORCE ── */}
        {rightSegments.map((seg, idx) => {
          const isLit   = isGActive(idx);
          const fill    = isLit ? getGColor() : theme.segUnlit;
          const opacity = isLit ? 1 : 0.35;

          return (
            <Polygon key={`g-seg-${idx}`} points={seg.points} fill={fill} opacity={opacity} />
          );
        })}

        {/* Speed scale tick labels along the left chevron */}
        {tickList.map((val) => {
          const ratio  = val / effectiveMaxSpeed;
          const segIdx = Math.min(TOTAL_SPEED_SEGMENTS - 1, Math.round(ratio * (TOTAL_SPEED_SEGMENTS - 1)));
          const pos    = leftSegments[segIdx]?.center;
          if (!pos) return null;

          return (
            <SvgText
              key={`tick-${val}`}
              x={pos.x - 14}
              y={pos.y + 3}
              fill={Colors.text.tertiary}
              fontSize={8.5}
              fontFamily={FontFamily.numberRegular}
              textAnchor="end"
            >
              {val}
            </SvgText>
          );
        })}
      </Svg>

      {/* ── DIGITAL SPEED READOUT (beside left chevron) ── */}
      <View style={styles.speedReadoutBox} pointerEvents="none">
        <Text
          variant="display"
          color={isIdle ? Colors.text.tertiary : Colors.text.primary}
          tabular
          style={styles.speedNumeral}
        >
          {speedDisplayString}
        </Text>
        <Text variant="overline" color={Colors.text.tertiary} style={styles.speedUnit}>
          {speedUnitLabel}
        </Text>
      </View>

      {/* ── DIGITAL G-FORCE READOUT (beside right chevron) ── */}
      <View style={styles.gReadoutBox} pointerEvents="none">
        <Text
          variant="metricL"
          color={
            !hasData || Math.abs(clampedG) < 0.05
              ? Colors.text.tertiary
              : clampedG > 0
              ? (isSport ? theme.segMid : Colors.accent.cyan)
              : (isSport ? theme.segHigh : Colors.semantic.warning)
          }
          tabular
          style={styles.gNumeral}
        >
          {!hasData || Math.abs(clampedG) < 0.05
            ? '—'
            : `${clampedG > 0 ? '+' : ''}${clampedG.toFixed(2)}G`}
        </Text>
        <Text variant="overline" color={Colors.text.tertiary} style={styles.gUnit}>
          {clampedG > 0 ? 'ACCEL' : clampedG < -0.05 ? 'BRAKE' : 'G-FORCE'}
        </Text>
      </View>

      {/* ── CENTRE: VEHICLE PHOTO / SILHOUETTE WITH THEMED GLOW ── */}
      <View style={styles.centerCarContainer} pointerEvents="none">
        <View
          style={[
            styles.glowBackdrop,
            { backgroundColor: theme.glowBg, borderColor: theme.glowBorder },
          ]}
        />
        <View style={styles.carFrame}>
          {vehiclePhotoUrl ? (
            <Image source={{ uri: vehiclePhotoUrl }} style={styles.carPhoto} resizeMode="cover" />
          ) : (
            <View style={styles.carSilhouetteBox}>
              <Icon
                name="car"
                size={34}
                color={isSport ? GaugeThemes.sport.segMid : Colors.accent.cyan}
                weight="duotone"
              />
            </View>
          )}
        </View>

        {/* ── BOTTOM ROW: GPS STATUS CHIP & TRIP DISTANCE ── */}
        <View style={styles.bottomTeleRow}>
          <View style={styles.gpsChip}>
            <View style={[styles.gpsDot, gpsStatus === 'locked' ? styles.dotGreen : styles.dotAmber]} />
            <Text variant="overline" color={Colors.text.secondary} style={styles.gpsLabel}>
              {gpsStatus === 'locked' ? 'GPS LOCKED' : 'ACQUIRING'}
            </Text>
          </View>

          {tripDistanceKm !== undefined && (
            <View style={styles.distanceChip}>
              <Icon name="path" size={10} color={Colors.text.tertiary} />
              <Text variant="overline" color={Colors.text.secondary} tabular style={styles.distanceLabel}>
                {tripDistanceKm.toFixed(1)} {distanceUnitLabel}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: Spacing[1],
  },
  speedReadoutBox: {
    position: 'absolute',
    left: 48,
    top: 48,
    alignItems: 'flex-start',
  },
  speedNumeral: {
    fontSize: 40,
    lineHeight: 44,
    fontFamily: FontFamily.display,
  },
  speedUnit: {
    fontSize: 10,
    marginTop: -2,
    letterSpacing: 0.8,
  },
  gReadoutBox: {
    position: 'absolute',
    right: 48,
    top: 54,
    alignItems: 'flex-end',
  },
  gNumeral: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: FontFamily.numberBold,
  },
  gUnit: {
    fontSize: 9,
    marginTop: 1,
    letterSpacing: 0.8,
  },
  centerCarContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 18,
  },
  glowBackdrop: {
    position: 'absolute',
    width: 108,
    height: 72,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  carFrame: {
    width: 96,
    height: 60,
    borderRadius: Radius.iconChip,
    backgroundColor: Colors.surface['2'],
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  carPhoto: {
    width: '100%',
    height: '100%',
  },
  carSilhouetteBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTeleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[2],
  },
  gpsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  gpsDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotGreen: {
    backgroundColor: Colors.semantic.success,
  },
  dotAmber: {
    backgroundColor: Colors.semantic.warning,
  },
  gpsLabel: {
    fontSize: 8.5,
    letterSpacing: 0.5,
  },
  distanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface['1'],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  distanceLabel: {
    fontSize: 8.5,
  },

  // ── Peak Mode Styles ──────────────────────────────────────────────────────
  peakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[2],
  },
  peakSvgWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakInfoColumn: {
    flex: 1,
    marginLeft: Spacing[4],
    justifyContent: 'center',
  },
  peakHeaderLabel: {
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
  },
  peakValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  peakSpeedValue: {
    fontSize: 38,
    lineHeight: 42,
  },
  peakUnitText: {
    fontSize: 14,
  },
});
