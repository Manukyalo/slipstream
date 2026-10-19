/**
 * TripCard — Recap Session Card with Route Snapshot Hero
 *
 * Requirements:
 *  - Displays route snapshot as 160px hero image with bottom gradient overlay
 *  - Fallback to clean header if snapshot_url is null
 *  - Moving time and pit stop badges when available
 *  - Tabular numbers on all metrics
 *  - Zero emojis, strict theme tokens
 */

import React from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import type { Trip } from '@/types/database';

export interface TripCardProps {
  trip: Trip;
  onShare: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}m`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TripCard({ trip, onShare }: TripCardProps) {
  const distKm = (Number(trip.distance_m) / 1000).toFixed(2);
  const topSpeed = Math.round(Number(trip.top_speed));
  const avgSpeed = Math.round(Number(trip.avg_speed));
  const pitCount = Number(trip.pit_stop_count ?? 0);
  const movingTime = trip.moving_time_s ? Number(trip.moving_time_s) : null;

  return (
    <View style={styles.card}>
      {/* Route Snapshot Hero */}
      {trip.snapshot_url ? (
        <View style={styles.heroContainer}>
          <Image source={{ uri: trip.snapshot_url }} style={styles.heroImage} />
          <LinearGradient
            colors={['transparent', 'rgba(14, 19, 27, 0.85)', Colors.surface['1']]}
            locations={[0, 0.65, 1]}
            style={styles.heroGradient}
          />

          {/* Floating Badges */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroGlassPill}>
              <Icon name="flag" size={12} color={Colors.accent.cyan} />
              <Text style={styles.badgeText}>
                {formatDate(trip.started_at)}
              </Text>
            </View>

            <View style={styles.heroBadgesRight}>
              {pitCount > 0 && (
                <View style={styles.pitStopBadge}>
                  <Icon name="pause" size={10} color={Colors.semantic.warning} weight="fill" />
                  <Text style={styles.pitStopBadgeText}>
                    {pitCount} {pitCount === 1 ? 'pit stop' : 'pit stops'}
                  </Text>
                </View>
              )}
              <View style={styles.durationBadge}>
                <Text variant="overline" color={Colors.accent.cyan}>
                  {formatDuration(movingTime ?? trip.duration_s)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* Fallback Header (no snapshot) */
        <View style={styles.header}>
          <View style={styles.dateWrap}>
            <Icon name="flag" size={14} color={Colors.text.tertiary} />
            <Text variant="label" color={Colors.text.primary}>
              {formatDate(trip.started_at)}
            </Text>
          </View>

          <View style={styles.fallbackBadges}>
            {pitCount > 0 && (
              <View style={styles.pitStopBadge}>
                <Icon name="pause" size={10} color={Colors.semantic.warning} weight="fill" />
                <Text style={styles.pitStopBadgeText}>{pitCount} pit</Text>
              </View>
            )}
            <View style={styles.durationBadge}>
              <Text variant="overline" color={Colors.accent.cyan}>
                {formatDuration(movingTime ?? trip.duration_s)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Body / Metrics */}
      <View style={[styles.body, trip.snapshot_url ? styles.bodyWithHero : null]}>
        <View style={styles.metrics}>
          <View style={styles.metricItem}>
            <Text variant="metricL" color={Colors.text.primary} tabular style={styles.metricValue}>
              {distKm}
            </Text>
            <Text variant="overline" color={Colors.text.tertiary} style={styles.metricUnit}>
              KM
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricItem}>
            <Text variant="metricL" color={Colors.text.primary} tabular style={styles.metricValue}>
              {topSpeed}
            </Text>
            <Text variant="overline" color={Colors.text.tertiary} style={styles.metricUnit}>
              PEAK KM/H
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.metricItem}>
            <Text variant="metricL" color={Colors.text.primary} tabular style={styles.metricValue}>
              {avgSpeed}
            </Text>
            <Text variant="overline" color={Colors.text.tertiary} style={styles.metricUnit}>
              AVG KM/H
            </Text>
          </View>
        </View>

        {/* Share Story Card Button */}
        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && styles.btnPressed]}
          onPress={onShare}
        >
          <Icon name="share" size={14} color={Colors.accent.cyan} />
          <Text variant="overline" color={Colors.accent.cyan}>
            SHARE STORY CARD
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  heroContainer: {
    height: 160,
    width: '100%',
    position: 'relative',
    backgroundColor: Colors.bg.base,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
  },
  heroTopRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroGlassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5, 7, 13, 0.75)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroBadgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.card,
    paddingBottom: 0,
  },
  dateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1],
  },
  fallbackBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationBadge: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.25)',
  },
  pitStopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  pitStopBadgeText: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    fontWeight: '600',
    color: Colors.semantic.warning,
    letterSpacing: 0.3,
  },
  body: {
    padding: Spacing.card,
    gap: Spacing.gap,
  },
  bodyWithHero: {
    paddingTop: Spacing[2],
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface['2'],
    borderRadius: Radius.iconChip,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[2],
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  metricValue: {
    fontSize: 26,
    lineHeight: 30,
  },
  metricUnit: {
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.hairline,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[3],
    borderRadius: Radius.button,
    backgroundColor: Colors.surface['2'],
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  btnPressed: {
    opacity: 0.7,
  },
});
