import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, FontFamily } from '@/constants/design';

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
  const strokeWidth = 14;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;

  // Gauge sweeps from 135deg to 405deg (270 degrees total arc)
  const startAngle = 135;
  const endAngle = 405;
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
      return ['M', startPoint.x, startPoint.y, 'A', r, r, 0, largeArcFlag, 1, endPoint.x, endPoint.y].join(' ');
    },
    [polarToCartesian],
  );

  const backgroundArc = useMemo(
    () => describeArc(center, center, radius, startAngle, endAngle),
    [describeArc, center, radius, startAngle, endAngle],
  );

  const activeArc = useMemo(() => {
    if (progressRatio <= 0.005) return '';
    return describeArc(center, center, radius, startAngle, currentAngle);
  }, [describeArc, center, radius, startAngle, currentAngle, progressRatio]);

  const needlePosition = useMemo(
    () => polarToCartesian(center, center, radius, currentAngle),
    [polarToCartesian, center, radius, currentAngle],
  );

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={Colors.accentCyan} />
            <Stop offset="75%" stopColor={Colors.accentCyan} />
            <Stop offset="100%" stopColor={Colors.accentOrange} />
          </LinearGradient>
        </Defs>

        {/* Outer track */}
        <Path
          d={backgroundArc}
          fill="none"
          stroke={Colors.bgElevated}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active progress track */}
        {activeArc ? (
          <Path
            d={activeArc}
            fill="none"
            stroke="url(#activeGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        ) : null}

        {/* Indicator bead at active head */}
        <Circle
          cx={needlePosition.x}
          cy={needlePosition.y}
          r={5}
          fill={Colors.textPrimary}
        />
      </Svg>

      {/* Numerical display in dial center */}
      <View style={styles.centerTextContainer}>
        <Text style={styles.speedValue}>{Math.round(speedKmh)}</Text>
        <Text style={styles.speedUnit}>KM/H</Text>

        {topSpeedKmh > 0 ? (
          <View style={styles.topSpeedBadge}>
            <Text style={styles.topSpeedLabel}>PEAK</Text>
            <Text style={styles.topSpeedVal}>{Math.round(topSpeedKmh)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedValue: {
    fontFamily: FontFamily.bold,
    fontSize: 56,
    color: Colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 60,
  },
  speedUnit: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: Colors.accentCyan,
    letterSpacing: 2,
    marginTop: -2,
  },
  topSpeedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgSurface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  topSpeedLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  topSpeedVal: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.accentOrange,
  },
});
