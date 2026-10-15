/**
 * Gauge — Precision Telemetry Instrument
 *
 * Specifications (Phase 3):
 *  - 0 to 260 km/h dial
 *  - Major and minor tick marks with Space Grotesk readouts
 *  - Dynamic gradient arc: cyan→blue baseline, turning amber (>120 km/h) then danger red (>180 km/h)
 *  - Needle with spring motion running at 60 fps via React Native Animated
 *  - Metric XL numerals (tabular figures) with subtle glow
 *  - EMA low-pass filtering to eliminate GPS micro-jitter
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { Colors, FontFamily } from '@/constants/theme';
import { usePreferences } from '@/contexts/PreferencesContext';
import { Text } from './Text';

interface GaugeProps {
  speedKmh: number;
  maxDialSpeed?: number;
  size?: number;
  unit?: string;
}

const MAJOR_TICKS_KMH = [0, 40, 80, 120, 160, 200, 240, 260];
const MAJOR_TICKS_MPH = [0, 20, 40, 60, 80, 100, 120, 140, 160];
const DIAL_MAX_KMH = 260;
const DIAL_MAX_MPH = 160;

// Dial sweep: 240 degrees (from 150° to 390°)
const START_ANGLE = 150;
const END_ANGLE = 390;
const TOTAL_ARC = END_ANGLE - START_ANGLE;

function polarToCartesian(centerX: number, centerY: number, r: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + r * Math.cos(angleInRadians),
    y: centerY + r * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, r: number, start: number, end: number) {
  const startPoint = polarToCartesian(x, y, r, start);
  const endPoint = polarToCartesian(x, y, r, end);
  const largeArcFlag = end - start <= 180 ? '0' : '1';
  return [
    'M',
    startPoint.x.toFixed(2),
    startPoint.y.toFixed(2),
    'A',
    r,
    r,
    0,
    largeArcFlag,
    1,
    endPoint.x.toFixed(2),
    endPoint.y.toFixed(2),
  ].join(' ');
}

export function Gauge({
  speedKmh,
  maxDialSpeed,
  size = 280,
  unit,
}: GaugeProps) {
  const { convertSpeed, speedUnitLabel } = usePreferences();
  const effectiveUnit = unit ?? speedUnitLabel;
  const isMph = effectiveUnit === 'mph';
  const effectiveSpeed = convertSpeed(speedKmh);
  const effectiveMaxDial = maxDialSpeed ?? (isMph ? DIAL_MAX_MPH : DIAL_MAX_KMH);

  const strokeWidth = 8;
  const radius = (size - strokeWidth * 6) / 2;
  const center = size / 2;

  // EMA smoothing filter to eliminate GPS sample jitter
  const smoothedSpeedRef = useRef(effectiveSpeed);
  const [animatedAngle] = useState(() => new Animated.Value(START_ANGLE));

  // Determine colour threshold
  const arcColor = useMemo(() => {
    const dangerThreshold = isMph ? 112 : 180;
    const warningThreshold = isMph ? 75 : 120;
    if (effectiveSpeed >= dangerThreshold) return Colors.semantic.danger;
    if (effectiveSpeed >= warningThreshold) return Colors.semantic.warning;
    return Colors.accent.cyan;
  }, [effectiveSpeed, isMph]);

  useEffect(() => {
    // Low-pass filter: alpha = 0.4
    const clamped = Math.min(Math.max(0, effectiveSpeed), effectiveMaxDial);
    const alpha = 0.4;
    const filtered = smoothedSpeedRef.current + alpha * (clamped - smoothedSpeedRef.current);
    smoothedSpeedRef.current = filtered;

    const ratio = filtered / effectiveMaxDial;
    const targetAngle = START_ANGLE + ratio * TOTAL_ARC;

    Animated.spring(animatedAngle, {
      toValue: targetAngle,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [effectiveSpeed, effectiveMaxDial, animatedAngle]);

  // Background track arc
  const backgroundTrack = useMemo(
    () => describeArc(center, center, radius, START_ANGLE, END_ANGLE),
    [center, radius],
  );

  // Active arc
  const currentRatio = Math.min(Math.max(0, effectiveSpeed), effectiveMaxDial) / effectiveMaxDial;
  const currentArcAngle = START_ANGLE + currentRatio * TOTAL_ARC;
  const activeArcPath = useMemo(() => {
    if (currentRatio <= 0.005) return '';
    return describeArc(center, center, radius, START_ANGLE, currentArcAngle);
  }, [center, radius, currentArcAngle, currentRatio]);

  // Generate tick marks
  const ticks = useMemo(() => {
    const majorList = isMph ? MAJOR_TICKS_MPH : MAJOR_TICKS_KMH;
    const minorStep = isMph ? 5 : 10;
    const list: {
      key: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      isMajor: boolean;
      value: number;
    }[] = [];

    for (let speed = 0; speed <= effectiveMaxDial; speed += minorStep) {
      const isMajor = majorList.includes(speed);
      const ratio = speed / effectiveMaxDial;
      const angle = START_ANGLE + ratio * TOTAL_ARC;

      const outerR = radius - strokeWidth / 2 - 2;
      const innerR = outerR - (isMajor ? 12 : 6);

      list.push({
        key: `tick-${speed}`,
        start: polarToCartesian(center, center, outerR, angle),
        end: polarToCartesian(center, center, innerR, angle),
        isMajor,
        value: speed,
      });
    }
    return list;
  }, [center, radius, isMph, effectiveMaxDial, strokeWidth]);

  // Needle rotation interpolation (from 150° to 390°, with 0 deg pointing straight up)
  const needleRotate = useMemo(
    () =>
      animatedAngle.interpolate({
        inputRange: [START_ANGLE, END_ANGLE],
        outputRange: [`${START_ANGLE - 90}deg`, `${END_ANGLE - 90}deg`],
      }),
    [animatedAngle],
  );


  return (
    <View style={[styles.container, { width: size, height: size * 0.88 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          {/* Cyan to blue baseline gradient */}
          <SvgLinearGradient id="gaugeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={Colors.accent.cyan} />
            <Stop offset="100%" stopColor={Colors.accent.blue} />
          </SvgLinearGradient>
          {/* Warning gradient */}
          <SvgLinearGradient id="warningGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={Colors.accent.cyan} />
            <Stop offset="60%" stopColor={Colors.semantic.warning} />
            <Stop offset="100%" stopColor={Colors.semantic.danger} />
          </SvgLinearGradient>
        </Defs>

        {/* Outer subtle glow ring */}
        <Path
          d={backgroundTrack}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={strokeWidth + 12}
          strokeLinecap="round"
        />

        {/* Background dark track */}
        <Path
          d={backgroundTrack}
          fill="none"
          stroke={Colors.surface['2']}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active speed arc with color transitions */}
        {activeArcPath ? (
          <Path
            d={activeArcPath}
            fill="none"
            stroke={speedKmh >= 120 ? 'url(#warningGradient)' : 'url(#gaugeGradient)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ) : null}

        {/* Tick marks */}
        {ticks.map((t) => (
          <Line
            key={t.key}
            x1={t.start.x}
            y1={t.start.y}
            x2={t.end.x}
            y2={t.end.y}
            stroke={t.isMajor ? Colors.text.secondary : 'rgba(255,255,255,0.15)'}
            strokeWidth={t.isMajor ? 2 : 1}
            strokeLinecap="round"
          />
        ))}

        {/* Center hub backing */}
        <Circle cx={center} cy={center} r={14} fill={Colors.surface['1']} />
        <Circle cx={center} cy={center} r={8} fill={arcColor} />
      </Svg>

      {/* Spring animated needle */}
      <Animated.View
        style={[
          styles.needleContainer,
          {
            width: size,
            height: size,
            transform: [{ rotate: needleRotate }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={[styles.needlePin, { height: radius - 16, backgroundColor: arcColor }]} />
      </Animated.View>

      {/* Hero metric readout */}
      <View style={styles.centerReadout} pointerEvents="none">
        <Text variant="metricXL" style={styles.speedNumeral}>
          {Math.round(Math.max(0, effectiveSpeed))}
        </Text>
        <Text variant="overline" color={Colors.text.tertiary} style={styles.unitText}>
          {effectiveUnit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    position: 'relative',
  },
  needleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needlePin: {
    width: 3,
    borderRadius: 2,
    position: 'absolute',
    bottom: '50%',
    shadowColor: Colors.accent.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  centerReadout: {
    position: 'absolute',
    top: '46%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedNumeral: {
    fontFamily: FontFamily.metric,
    fontSize: 64,
    lineHeight: 64,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
    textAlign: 'center',
  },
  unitText: {
    letterSpacing: 1.5,
    marginTop: 2,
  },
});
