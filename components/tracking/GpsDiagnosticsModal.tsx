/**
 * GpsDiagnosticsModal — Hidden GPS Telemetry Diagnostics Sheet
 *
 * Triggered by long-pressing the GPS Quality Pill.
 * Displays:
 *  - Raw Doppler speed (m/s and km/h)
 *  - Accuracy radius (meters)
 *  - Fix age (ms since last fix)
 *  - Provider (GPS / Fused / Mock)
 *  - Time to First Fix (TTFF)
 *  - Consecutive good fixes count
 */

import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';

export interface GpsDiagnosticsData {
  rawSpeedMs: number;
  accuracy: number | null;
  fixAgeMs: number | null;
  provider: string;
  ttffSeconds: number | null;
  consecutiveGoodFixes: number;
}

interface GpsDiagnosticsModalProps {
  visible: boolean;
  onClose: () => void;
  data: GpsDiagnosticsData;
}

export function GpsDiagnosticsModal({
  visible,
  onClose,
  data,
}: GpsDiagnosticsModalProps) {
  const rawKmh = (data.rawSpeedMs * 3.6).toFixed(1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Icon name="gauge" size={20} color={Colors.accent.cyan} weight="bold" />
              <Text variant="heading" color={Colors.text.primary} style={styles.title}>
                GPS Engine Diagnostics
              </Text>
            </View>
            <Pressable hitSlop={12} onPress={onClose}>
              <Icon name="close" size={20} color={Colors.text.tertiary} />
            </Pressable>
          </View>

          {/* Diagnostics rows */}
          <View style={styles.rowsContainer}>
            <View style={styles.diagRow}>
              <Text variant="label" color={Colors.text.tertiary}>Raw Doppler Speed</Text>
              <Text variant="body" color={Colors.text.primary} tabular style={styles.value}>
                {data.rawSpeedMs.toFixed(2)} m/s ({rawKmh} km/h)
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text variant="label" color={Colors.text.tertiary}>Accuracy Radius</Text>
              <Text variant="body" color={Colors.text.primary} tabular style={styles.value}>
                {data.accuracy !== null ? `${Math.round(data.accuracy)} m` : 'Unknown'}
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text variant="label" color={Colors.text.tertiary}>Fix Age</Text>
              <Text variant="body" color={Colors.text.primary} tabular style={styles.value}>
                {data.fixAgeMs !== null ? `${Math.max(0, data.fixAgeMs)} ms ago` : 'No fix'}
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text variant="label" color={Colors.text.tertiary}>Provider</Text>
              <Text variant="body" color={Colors.text.primary} style={styles.value}>
                {data.provider}
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text variant="label" color={Colors.text.tertiary}>Time to First Fix (TTFF)</Text>
              <Text variant="body" color={Colors.text.primary} tabular style={styles.value}>
                {data.ttffSeconds !== null ? `${data.ttffSeconds.toFixed(2)} s` : 'Acquiring...'}
              </Text>
            </View>

            <View style={styles.diagRow}>
              <Text variant="label" color={Colors.text.tertiary}>Consecutive Good Fixes</Text>
              <Text variant="body" color={Colors.text.primary} tabular style={styles.value}>
                {data.consecutiveGoodFixes}
              </Text>
            </View>
          </View>

          <Button variant="secondary" onPress={onClose} style={styles.closeBtn}>
            Close Diagnostics
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing[4],
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.surface['2'],
    padding: Spacing[4],
    gap: Spacing[3],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  title: {
    fontSize: 16,
    fontFamily: FontFamily.heading,
  },
  rowsContainer: {
    gap: Spacing[2],
  },
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  value: {
    fontFamily: FontFamily.numberBold,
    fontSize: 13,
  },
  closeBtn: {
    marginTop: Spacing[2],
  },
});
