/**
 * Compete — hub screen for Drag, Circuit and Rankings
 *
 * A Segmented control at the top switches between the three modes.
 * Conditional rendering (no nested navigator) keeps this OTA-updatable.
 *
 * The underlying screen components (drag-race.tsx, track-day.tsx, rankings.tsx)
 * remain untouched and are imported directly here.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { Segmented } from '@/components/ui/Segmented';

// Lazy-import the three screens to avoid loading all three on mount
import DragRaceScreen from './drag-race';
import TrackDayScreen from './track-day';
import RankingsScreen from './rankings';

const SEGMENTS = ['Drag', 'Circuit', 'Rankings'] as const;

export default function CompeteScreen() {
  const [active, setActive] = useState<number>(0);
  const insets = useSafeAreaInsets();

  const activeSegment = SEGMENTS[active];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Segmented control pinned below the status bar */}
      <View style={styles.segmentedBar}>
        <Segmented
          options={[...SEGMENTS]}
          selected={active}
          onChange={setActive}
        />
      </View>

      {/* Screen content — rendered conditionally, not mounted all at once */}
      <View style={styles.content}>
        {activeSegment === 'Drag'     && <DragRaceScreen isEmbedded />}
        {activeSegment === 'Circuit'  && <TrackDayScreen isEmbedded />}
        {activeSegment === 'Rankings' && <RankingsScreen isEmbedded />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: Colors.bg.base,
  },
  segmentedBar: {
    paddingHorizontal: Spacing.screen,
    paddingVertical:   Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  content: {
    flex: 1,
  },
});
