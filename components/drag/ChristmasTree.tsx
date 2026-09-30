import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Circle, Line } from 'react-native-svg';
import { Theme } from '@/constants/theme';
import type { DragRaceStatus } from '@/hooks/useDragRace';

interface ChristmasTreeProps {
  status: DragRaceStatus;
}

export function ChristmasTree({ status }: ChristmasTreeProps) {
  const isPreStaged = status === 'staging' || status === 'staged' || status === 'running';
  const isStaged = status === 'staged' || status === 'running';
  const isGreen = status === 'running';

  // SVG dimensions for real drag strip tree proportions
  const width = 120;
  const height = 180;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox="0 0 120 180">
        {/* Central Mast */}
        <Rect x="58" y="8" width="4" height="164" fill={Theme.colors.surfaceRaised} rx="2" />

        {/* Crossbars */}
        <Line x1="36" y1="26" x2="84" y2="26" stroke={Theme.colors.surfaceBorder} strokeWidth="2" />
        <Line x1="36" y1="52" x2="84" y2="52" stroke={Theme.colors.surfaceBorder} strokeWidth="2" />
        <Line x1="30" y1="84" x2="90" y2="84" stroke={Theme.colors.surfaceBorder} strokeWidth="2" />
        <Line x1="30" y1="116" x2="90" y2="116" stroke={Theme.colors.surfaceBorder} strokeWidth="2" />
        <Line x1="30" y1="148" x2="90" y2="148" stroke={Theme.colors.surfaceBorder} strokeWidth="2" />

        {/* 1. Pre-Stage Bulbs (Top small blue/white or amber) */}
        <Circle
          cx="42"
          cy="26"
          r="6"
          fill={isPreStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isPreStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />
        <Circle
          cx="78"
          cy="26"
          r="6"
          fill={isPreStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isPreStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />

        {/* 2. Stage Bulbs */}
        <Circle
          cx="42"
          cy="52"
          r="6"
          fill={isStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />
        <Circle
          cx="78"
          cy="52"
          r="6"
          fill={isStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />

        {/* 3. Amber Countdown 1 */}
        <Circle
          cx="38"
          cy="84"
          r="10"
          fill={isStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />
        <Circle
          cx="82"
          cy="84"
          r="10"
          fill={isStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />

        {/* 4. Amber Countdown 2 */}
        <Circle
          cx="38"
          cy="116"
          r="10"
          fill={isStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />
        <Circle
          cx="82"
          cy="116"
          r="10"
          fill={isStaged ? Theme.colors.ignitionAmber : '#1A2129'}
          stroke={isStaged ? Theme.colors.ignitionAmber : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />

        {/* 5. Green Launch Bulbs */}
        <Circle
          cx="38"
          cy="148"
          r="10"
          fill={isGreen ? '#22C55E' : '#1A2129'}
          stroke={isGreen ? '#22C55E' : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />
        <Circle
          cx="82"
          cy="148"
          r="10"
          fill={isGreen ? '#22C55E' : '#1A2129'}
          stroke={isGreen ? '#22C55E' : Theme.colors.surfaceBorder}
          strokeWidth="1.5"
        />
      </Svg>

      {/* Status Readout */}
      <Text
        style={[
          styles.statusText,
          isGreen
            ? styles.statusGreen
            : isStaged
            ? styles.statusAmber
            : styles.statusMuted,
        ]}
      >
        {status === 'idle'
          ? 'Ready to stage'
          : status === 'staging'
          ? 'Calibrating sensors...'
          : status === 'staged'
          ? 'Launch vehicle'
          : status === 'running'
          ? 'Full throttle'
          : 'Run completed'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  statusText: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.5,
    marginTop: 8,
    textAlign: 'center',
  },
  statusGreen: {
    color: '#22C55E',
  },
  statusAmber: {
    color: Theme.colors.ignitionAmber,
  },
  statusMuted: {
    color: Theme.colors.textMuted,
  },
});
