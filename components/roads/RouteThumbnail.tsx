/**
 * RouteThumbnail — High-Performance Vector Route Polyline Preview
 *
 * Parses WKT LINESTRING and normalizes to an SVG path viewBox.
 * Works completely offline with zero network overhead.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Colors } from '@/constants/theme';

interface RouteThumbnailProps {
  routeWkt?: string;
  width?: number | `${number}%`;
  height?: number;
}

export function RouteThumbnail({
  routeWkt,
  width = '100%',
  height = 110,
}: RouteThumbnailProps) {
  const parsedData = useMemo(() => {
    if (!routeWkt || !routeWkt.startsWith('LINESTRING')) {
      return null;
    }

    try {
      const coordStr = routeWkt.replace(/LINESTRING\s*\(/i, '').replace(/\)/, '').trim();
      const rawPairs = coordStr.split(',').map((p) => p.trim());
      const points: [number, number][] = [];

      for (const pair of rawPairs) {
        const [lonStr, latStr] = pair.split(/\s+/);
        const lon = parseFloat(lonStr);
        const lat = parseFloat(latStr);
        if (!isNaN(lon) && !isNaN(lat)) {
          points.push([lon, lat]);
        }
      }

      if (points.length < 2) return null;

      // Calculate bounding box
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      const dx = maxX - minX || 0.0001;
      const dy = maxY - minY || 0.0001;

      // Project into 260 x 100 viewBox with padding
      const pad = 16;
      const targetW = 260 - pad * 2;
      const targetH = 100 - pad * 2;

      const pathSegments: string[] = [];
      let startPt = { x: 0, y: 0 };
      let endPt = { x: 0, y: 0 };

      points.forEach(([x, y], idx) => {
        // Invert Y because latitude increases northward while SVG Y increases downward
        const normX = pad + ((x - minX) / dx) * targetW;
        const normY = pad + (1 - (y - minY) / dy) * targetH;

        if (idx === 0) {
          pathSegments.push(`M ${normX.toFixed(1)} ${normY.toFixed(1)}`);
          startPt = { x: normX, y: normY };
        } else {
          pathSegments.push(`L ${normX.toFixed(1)} ${normY.toFixed(1)}`);
        }
        if (idx === points.length - 1) {
          endPt = { x: normX, y: normY };
        }
      });

      return {
        path: pathSegments.join(' '),
        start: startPt,
        end: endPt,
      };
    } catch {
      return null;
    }
  }, [routeWkt]);

  // Fallback decorative twisty road path if no raw points exist
  const fallbackPath = 'M 20 80 C 60 20, 100 90, 140 30 S 200 90, 240 25';

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox="0 0 260 100" preserveAspectRatio="xMidYMid meet">
        <Defs>
          <LinearGradient id="routeGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0A0E17" stopOpacity="1" />
            <Stop offset="100%" stopColor="#080C14" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Dark subtle tile backdrop */}
        <Rect x="0" y="0" width="260" height="100" rx="12" fill="url(#bgGrad)" />

        {parsedData ? (
          <>
            {/* Outer halo */}
            <Path
              d={parsedData.path}
              stroke="#22D3EE"
              strokeWidth={8}
              strokeOpacity={0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Core telemetry route */}
            <Path
              d={parsedData.path}
              stroke="url(#routeGrad)"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Start pin: green */}
            <Circle cx={parsedData.start.x} cy={parsedData.start.y} r={4} fill={Colors.semantic.success} />
            {/* End pin: cyan */}
            <Circle cx={parsedData.end.x} cy={parsedData.end.y} r={4} fill={Colors.accent.cyan} />
          </>
        ) : (
          <>
            <Path
              d={fallbackPath}
              stroke="#22D3EE"
              strokeWidth={7}
              strokeOpacity={0.15}
              strokeLinecap="round"
              fill="none"
            />
            <Path
              d={fallbackPath}
              stroke="url(#routeGrad)"
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={20} cy={80} r={4} fill={Colors.semantic.success} />
            <Circle cx={240} cy={25} r={4} fill={Colors.accent.cyan} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#080C14',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
});
