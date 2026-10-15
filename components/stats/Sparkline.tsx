/**
 * Sparkline — Telemetry Trend Visualization
 *
 * Renders an SVG bezier line and gradient area fill for period distance/activity.
 * Uses Colors.accent.cyan and smooth path interpolation.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import { Colors } from '@/constants/theme';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  strokeColor?: string;
  fillOpacity?: number;
  showEndpoint?: boolean;
  style?: ViewStyle;
}

export function Sparkline({
  data,
  width = 280,
  height = 56,
  strokeColor = Colors.accent.cyan,
  showEndpoint = true,
  style,
}: SparklineProps) {
  const points = useMemo(() => {
    if (!data || data.length === 0) return [0, 0, 0, 0, 0, 0, 0];
    return data;
  }, [data]);

  const { linePath, areaPath, lastPoint } = useMemo(() => {
    const padX = 6;
    const padY = 8;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const maxVal = Math.max(...points, 1);
    const minVal = 0;
    const range = maxVal - minVal || 1;

    const coords = points.map((val, idx) => {
      const x = padX + (idx / Math.max(1, points.length - 1)) * usableW;
      const normalized = (val - minVal) / range;
      const y = padY + usableH - normalized * usableH;
      return { x, y };
    });

    if (coords.length < 2) {
      return { linePath: '', areaPath: '', lastPoint: coords[0] ?? { x: 0, y: 0 } };
    }

    // Build smooth bezier curve
    let dLine = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i === 0 ? 0 : i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] ?? p2;

      // Catmull-Rom to cubic bezier conversion factor
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      dLine += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const last = coords[coords.length - 1];
    const first = coords[0];
    const dArea = `${dLine} L ${last.x.toFixed(1)} ${(height).toFixed(1)} L ${first.x.toFixed(1)} ${(height).toFixed(1)} Z`;

    return { linePath: dLine, areaPath: dArea, lastPoint: last };
  }, [points, width, height]);

  const hasActivity = useMemo(() => points.some((v) => v > 0), [points]);

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <SvgLinearGradient id="sparkGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.28} />
            <Stop offset="75%" stopColor={strokeColor} stopOpacity={0.05} />
            <Stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>

        {hasActivity ? (
          <>
            <Path d={areaPath} fill="url(#sparkGradient)" />
            <Path
              d={linePath}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {showEndpoint && lastPoint && (
              <>
                <Circle
                  cx={lastPoint.x}
                  cy={lastPoint.y}
                  r={5}
                  fill={strokeColor}
                  fillOpacity={0.3}
                />
                <Circle cx={lastPoint.x} cy={lastPoint.y} r={3} fill={strokeColor} />
              </>
            )}
          </>
        ) : (
          /* Subtle flat baseline when zero data */
          <Path
            d={`M 6 ${height - 12} L ${width - 6} ${height - 12}`}
            stroke={Colors.surface['3']}
            strokeWidth={1.5}
            strokeDasharray="4,4"
            fill="none"
          />
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
