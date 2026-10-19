/**
 * PitStopControls — Live Pit Stop Status & Tag Selection
 *
 * Requirements:
 *  - Amber "Pit stop MM:SS" live timer using pitStopElapsedSeconds from context
 *  - Tabular numbers for clean digit transitions
 *  - Quick-tag selection: Fuel, Food, Rest, Other chips
 *  - Haptics on tag selection and action taps
 *  - Strict theme tokens (Colors, Radius, Spacing, FontFamily)
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import type { PitStopTag } from '@/utils/telemetry';

export interface PitStopControlsProps {
  pitStopElapsedSeconds: number;
  currentTag: PitStopTag | null;
  onSelectTag: (tag: PitStopTag) => void;
}

const PIT_STOP_TAGS: { key: PitStopTag; label: string }[] = [
  { key: 'fuel', label: 'Fuel' },
  { key: 'food', label: 'Food' },
  { key: 'rest', label: 'Rest' },
  { key: 'other', label: 'Other' },
];

export function PitStopControls({
  pitStopElapsedSeconds,
  currentTag,
  onSelectTag,
}: PitStopControlsProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTagPress = async (tag: PitStopTag) => {
    await Haptics.selectionAsync();
    onSelectTag(tag);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <View style={styles.amberDot} />
          <Icon name="pause" size={14} color={Colors.semantic.warning} weight="fill" />
          <Text style={styles.title}>PIT STOP</Text>
        </View>

        <Text style={styles.timerText} tabular>
          {formatDuration(pitStopElapsedSeconds)}
        </Text>
      </View>

      <View style={styles.tagRow}>
        {PIT_STOP_TAGS.map((item) => {
          const isSelected = currentTag === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => handleTagPress(item.key)}
              activeOpacity={0.75}
              style={[
                styles.chip,
                isSelected ? styles.chipSelected : styles.chipUnselected,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: Radius.card,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
    marginBottom: Spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amberDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.semantic.warning,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.semantic.warning,
    letterSpacing: 0.8,
  },
  timerText: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.semantic.warning,
    letterSpacing: 0.5,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipUnselected: {
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  chipSelected: {
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderColor: Colors.semantic.warning,
  },
  chipText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  chipTextUnselected: {
    color: Colors.text.secondary,
  },
  chipTextSelected: {
    color: Colors.semantic.warning,
  },
});
