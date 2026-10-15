/**
 * FilterChip — pill-shaped toggle chip for filter controls
 *
 * Active:   cyan border + 16% cyan tint background
 * Inactive: surface.2 background, no border
 *
 * Usage:
 *   <FilterChip label="Today" active={filter === 'today'} onPress={() => setFilter('today')} />
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Text } from './Text';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function FilterChip({ label, active = false, onPress, style }: FilterChipProps) {
  async function handlePress() {
    await Haptics.selectionAsync();
    onPress?.();
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        active ? styles.active : styles.inactive,
        style,
      ]}
    >
      <Text
        variant="label"
        color={active ? Colors.accent.cyan : Colors.text.secondary}
        style={styles.label}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius:    Radius.pill,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
  },
  active: {
    backgroundColor: Colors.tint.cyan,
    borderWidth:     1,
    borderColor:     Colors.accent.cyan,
  },
  inactive: {
    backgroundColor: Colors.surface['2'],
    borderWidth:     1,
    borderColor:     Colors.hairline,
  },
  label: {
    fontWeight: '600',
  },
});
