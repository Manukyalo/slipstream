import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Theme } from '@/constants/theme';

interface SpeedometerProps {
  speedKmh: number;
  topSpeedKmh?: number;
  maxDialSpeed?: number;
  size?: number;
}

export const Speedometer: React.FC<SpeedometerProps> = ({
  speedKmh,
  topSpeedKmh = 0,
  maxDialSpeed = 240,
  size = 240,
}) => {
  // Precision thin-stroke instrument styling
  const strokeWidth = 5;
  const radius = (size - strokeWidth * 4) / 2;
  const center = size / 2;

  // Sweeps 240 degrees (from 150deg to 390deg)
  const startAngle = 150;
  const endAngle = 390;
  const totalArc = endAngle - startAngle;

  const clampedSpeed = Math.min(Math.max(0, speedKmh), maxDialSpeed);
  const progressRatio = clampedSpeed / maxDialSpeed;
  const currentAngle = startAngle + progressRatio * totalArc;

  const polarToCartesian = useCallback(
    (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
      const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
      return {
        x: centerX + r * Math.cos(angleInRadians),
        y: centerY + r * Math.sin(angleInRadians),
      };
    },
    [],
  );

  const describeArc = useCallback(
    (x: number, y: number, r: number, start: number, end: number) => {
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
    },
    [polarToCartesian],
  );

  const backgroundArc = useMemo(
    () => describeArc(center, center, radius, startAngle, endAngle),
    [describeArc, center, radius, startAngle, endAngle],
  );

  const activeArc = useMemo(() => {
    if (progressRatio <= 0.002) return '';
    return describeArc(center, center, radius, startAngle, currentAngle);
  }, [describeArc, center, radius, startAngle, currentAngle, progressRatio]);

  // Leading needle tip
  const needleTip = useMemo(
    () => polarToCartesian(center, center, radius, currentAngle),
    [polarToCartesian, center, radius, currentAngle],
  );

  return (
    <View style={[styles.container, { width: size, height: size * 0.85 }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Graphite background track */}
        <Path
          d={backgroundArc}
          fill="none"
          stroke={Theme.colors.surfaceRaised}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active signal-cyan telemetry arc */}
        {activeArc ? (
          <Path
            d={activeArc}
            fill="none"
            stroke={Theme.colors.signalCyan}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ) : null}

        {/* Needle indicator dot */}
        <Circle
          cx={needleTip.x}
          cy={needleTip.y}
          r={4}
          fill={Theme.colors.signalCyan}
        />
      </Svg>

      {/* Central hero readout */}
      <View style={styles.centerReadout}>
        <Text style={styles.speedNumeral}>{Math.round(clampedSpeed)}</Text>
        <Text style={styles.unitLabel}>km/h</Text>
        {topSpeedKmh > 0 && (
          <Text style={styles.topSpeedLabel}>
            TOP <Text style={styles.topSpeedVal}>{Math.round(topSpeedKmh)}</Text>
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerReadout: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: '32%',
  },
  speedNumeral: {
    fontFamily: Theme.fonts.numberBold,
    fontVariant: ['tabular-nums'],
    fontSize: 58,
    lineHeight: 64,
    color: Theme.colors.textPrimary,
    letterSpacing: -1,
  },
  unitLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    color: Theme.colors.textMuted,
    textTransform: 'lowercase',
    marginTop: -4,
  },
  topSpeedLabel: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: Theme.colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 6,
  },
  topSpeedVal: {
    fontFamily: Theme.fonts.numberSemiBold,
    color: Theme.colors.signalCyan,
  },
});
