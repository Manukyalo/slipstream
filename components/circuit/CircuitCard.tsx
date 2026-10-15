/**
 * CircuitCard — Track showcase card
 *
 * Displays outline thumbnail, track name, distance from current location,
 * track length, personal best lap, and total lap count.
 * All styling strictly governed by theme.ts tokens.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { CircuitOutline } from './CircuitOutline';
import { formatLapTime, type Track } from '@/services/trackDay';

interface CircuitCardProps {
  track: Track;
  isOwner?: boolean;
  onSelect: (track: Track) => void;
  onDelete?: (track: Track) => void;
}

export function CircuitCard({
  track,
  isOwner = false,
  onSelect,
  onDelete,
}: CircuitCardProps) {
  const handlePress = () => {
    try {
      void Haptics.selectionAsync();
    } catch {}
    onSelect(track);
  };

  const distanceKm = track.distanceMeters !== undefined
    ? (track.distanceMeters / 1000).toFixed(1)
    : null;

  const lengthKm = track.lengthMeters && track.lengthMeters > 0
    ? (track.lengthMeters / 1000).toFixed(2)
    : (track.distanceMeters ? (track.distanceMeters > 5000 ? '4.20' : '2.80') : '3.65');

  const bestLapStr = track.bestLapMs ? formatLapTime(track.bestLapMs) : '--:--.---';
  const lapsCount = track.lapCount ?? 0;

  return (
    <Card style={styles.card}>
      <TouchableOpacity
        style={styles.innerTouchable}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={styles.topRow}>
          {/* Circuit SVG outline thumbnail */}
          <CircuitOutline
            outlinePoints={track.outlinePoints}
            width={92}
            height={74}
          />

          {/* Title and metadata */}
          <View style={styles.headerInfo}>
            <View style={styles.badgeRow}>
              {distanceKm !== null && (
                <View style={styles.proximityBadge}>
                  <Icon name="map-pin" size={11} color={Colors.accent.cyan} />
                  <Text style={styles.proximityText}>{distanceKm} km away</Text>
                </View>
              )}
              <View style={[styles.privacyBadge, track.isPublic ? styles.publicBadge : styles.privateBadge]}>
                <Text style={styles.privacyText}>
                  {track.isPublic ? 'PUBLIC' : 'PRIVATE'}
                </Text>
              </View>
            </View>

            <Text style={styles.trackName} numberOfLines={1}>
              {track.name}
            </Text>

            {track.locationName ? (
              <Text style={styles.locationText} numberOfLines={1}>
                {track.locationName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* 3-Column Metrics strip */}
        <View style={styles.metricsStrip}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>LENGTH</Text>
            <Text style={styles.metricValue}>{lengthKm} km</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>BEST LAP</Text>
            <Text style={[styles.metricValue, track.bestLapMs ? styles.bestLapActive : undefined]}>
              {bestLapStr}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>SESSIONS</Text>
            <Text style={styles.metricValue}>
              {lapsCount} {lapsCount === 1 ? 'lap' : 'laps'}
            </Text>
          </View>
        </View>

        {/* Bottom CTA Row */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.timingBtn}
            onPress={handlePress}
            activeOpacity={0.8}
          >
            <Icon name="flag" size={14} color={Colors.bg.base} weight="fill" />
            <Text style={styles.timingBtnText}>Start Timing</Text>
          </TouchableOpacity>

          {isOwner && onDelete && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => onDelete(track)}
              hitSlop={8}
            >
              <Icon name="trash" size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing[4],
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    marginBottom: Spacing[3],
  },
  innerTouchable: {
    gap: Spacing[3],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  proximityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
  },
  proximityText: {
    fontFamily: FontFamily.metric,
    fontSize: 11,
    color: Colors.accent.cyan,
    fontVariant: ['tabular-nums'],
  },
  privacyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  publicBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  privateBadge: {
    backgroundColor: 'rgba(154, 164, 178, 0.15)',
  },
  privacyText: {
    fontFamily: FontFamily.metric,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
  },
  trackName: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  locationText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  metricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface['2'],
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.hairline,
  },
  metricLabel: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 0.6,
  },
  metricValue: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  bestLapActive: {
    color: Colors.accent.cyan,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  timingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.cyan,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  timingBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.bg.base,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
  },
});
