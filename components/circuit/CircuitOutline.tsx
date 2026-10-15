/**
 * CircuitOutline — High performance SVG thumbnail for racetrack layouts
 *
 * Renders a closed-loop track silhouette with start/finish gate marker in cyan neon.
 * If actual GPS outline points are provided, normalizes them to viewBox;
 * otherwise generates an aerodynamic procedural circuit layout.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Colors } from '@/constants/theme';
import type { TrackPoint } from '@/services/trackDay';

interface CircuitOutlineProps {
  outlinePoints?: TrackPoint[];
  width?: number;
  height?: number;
}

export function CircuitOutline({
  outlinePoints = [],
  width = 100,
  height = 80,
}: CircuitOutlineProps) {
  const { pathData, gatePoint } = useMemo(() => {
    if (outlinePoints && outlinePoints.length >= 4) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      outlinePoints.forEach((p) => {
        if (p.lon < minX) minX = p.lon;
        if (p.lon > maxX) maxX = p.lon;
        if (p.lat < minY) minY = p.lat;
        if (p.lat > maxY) maxY = p.lat;
      });

      const spanX = maxX - minX || 0.001;
      const spanY = maxY - minY || 0.001;

      const pad = 12;
      const innerW = width - pad * 2;
      const innerH = height - pad * 2;

      const pts = outlinePoints.map((p) => {
        const x = pad + ((p.lon - minX) / spanX) * innerW;
        // Invert Y for latitude to SVG
        const y = pad + ((maxY - p.lat) / spanY) * innerH;
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
      });

      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x} ${pts[i].y}`;
      }
      d += ' Z';

      return { pathData: d, gatePoint: pts[0] };
    }

    // Default procedural circuit silhouette (Spa/Silverstone inspired high-speed layout)
    const d = `
      M 22 58
      C 15 58, 12 50, 15 42
      C 18 34, 25 36, 32 30
      C 38 24, 40 16, 52 14
      C 65 12, 78 18, 84 26
      C 90 35, 86 48, 76 52
      C 68 56, 58 48, 48 54
      C 40 60, 30 58, 22 58
      Z
    `.replace(/\s+/g, ' ').trim();

    return { pathData: d, gatePoint: { x: 22, y: 58 } };
  }, [outlinePoints, width, height]);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="circuitGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={Colors.accent.cyan} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={Colors.accent.blue} stopOpacity={0.8} />
          </LinearGradient>
        </Defs>

        {/* Ambient track glow */}
        <Path
          d={pathData}
          stroke={Colors.accent.cyan}
          strokeWidth={5}
          strokeOpacity={0.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Main track asphalt ribbon */}
        <Path
          d={pathData}
          stroke="url(#circuitGrad)"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start/Finish line gate indicator */}
        {gatePoint && (
          <>
            <Circle
              cx={gatePoint.x}
              cy={gatePoint.y}
              r={4}
              fill={Colors.accent.cyan}
            />
            <Circle
              cx={gatePoint.x}
              cy={gatePoint.y}
              r={6.5}
              stroke={Colors.semantic.success}
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="2,2"
            />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface['1'],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
