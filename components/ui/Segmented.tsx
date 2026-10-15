/**
 * Segmented — horizontal segmented control
 *
 * Active segment: surface.2 fill + animated cyan underline pill.
 * Slide animation on segment change via Animated.spring.
 *
 * Usage:
 *   <Segmented
 *     options={['Drag', 'Circuit', 'Rankings']}
 *     selected={activeIndex}
 *     onChange={setActiveIndex}
 *   />
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Text } from './Text';

interface SegmentedProps {
  options: string[];
  selected: number;
  onChange: (index: number) => void;
}

export function Segmented({ options, selected, onChange }: SegmentedProps) {
  const [slideAnim] = useState(() => new Animated.Value(0));
  const [segmentWidth, setSegmentWidth] = useState(0);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue:         selected * segmentWidth,
      useNativeDriver: true,
      tension:         120,
      friction:        10,
    }).start();
  }, [selected, segmentWidth, slideAnim]);

  function onLayout(e: LayoutChangeEvent) {
    const totalWidth = e.nativeEvent.layout.width;
    const width = totalWidth / options.length;
    setSegmentWidth(width);
    // Jump to correct position without animation on first render
    slideAnim.setValue(selected * width);
  }

  async function handlePress(index: number) {
    if (index === selected) return;
    await Haptics.selectionAsync();
    onChange(index);
  }

  return (
    <View style={styles.track} onLayout={onLayout}>
      {/* Animated active background pill */}
      <Animated.View
        style={[
          styles.activePill,
          { transform: [{ translateX: slideAnim }] },
          segmentWidth > 0 && { width: segmentWidth },
        ]}
      />

      {options.map((label, i) => (
        <TouchableOpacity
          key={label}
          style={styles.segment}
          onPress={() => handlePress(i)}
          activeOpacity={0.7}
        >
          <Text
            variant="label"
            color={i === selected ? Colors.text.primary : Colors.text.tertiary}
            style={styles.label}
          >
            {label}
          </Text>
          {/* Cyan underline on active segment */}
          {i === selected && <View style={styles.indicator} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection:   'row',
    backgroundColor: Colors.surface['1'],
    borderRadius:    Radius.button,
    overflow:        'hidden',
    position:        'relative',
    borderWidth:     1,
    borderColor:     Colors.hairline,
  },
  activePill: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    backgroundColor: Colors.surface['2'],
    borderRadius:    Radius.button,
  },
  segment: {
    flex:           1,
    paddingVertical: Spacing[3],
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  indicator: {
    width:           20,
    height:          3,
    borderRadius:    Radius.pill,
    backgroundColor: Colors.accent.cyan,
  },
});
