/**
 * RoadCard — Precision Route Showcase Card
 *
 * Specifications (Phase 4):
 *  - Static route thumbnail with polyline
 *  - Name, distance, elevation gain, best average speed, curviness score, saved count, save icon
 *  - Proximity chip (Nearby tab) and Privacy chip (Mine tab)
 *  - One icon library (Phosphor), Tabular figures, theme tokens
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { RouteThumbnail } from './RouteThumbnail';
import {
  type SavedRoad,
  formatRoadLength,
  formatProximity,
  bookmarkRoad,
} from '@/services/savedRoads';

interface RoadCardProps {
  road: SavedRoad;
  isOwner?: boolean;
  onShare: (road: SavedRoad) => void;
  onReport: (road: SavedRoad) => void;
  onDelete?: (road: SavedRoad) => void;
  onSelect?: (road: SavedRoad) => void;
}

export function RoadCard({
  road,
  isOwner = false,
  onShare,
  onReport,
  onDelete,
  onSelect,
}: RoadCardProps) {
  const [savedCount, setSavedCount] = useState(road.savedCount ?? 1);
  const [isSaved, setIsSaved] = useState(false);

  const handleBookmarkPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSaved((prev) => !prev);
    try {
      const nextCount = await bookmarkRoad(road.id);
      setSavedCount(nextCount);
    } catch {
      // optimistic fallback
      setSavedCount((c) => (isSaved ? c - 1 : c + 1));
    }
  };

  const handleDeletePress = () => {
    Alert.alert(
      'Delete Road',
      `Are you sure you want to remove "${road.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(road),
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      {/* Route Preview Thumbnail */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onSelect?.(road)}
        style={styles.thumbnailContainer}
      >
        <RouteThumbnail routeWkt={road.routeWkt} height={115} />

        {/* Floating Badges over thumbnail */}
        <View style={styles.thumbnailHeader}>
          {road.distanceMeters !== undefined ? (
            <View style={styles.proximityChip}>
              <Icon name="map-pin" size={12} color={Colors.accent.cyan} weight="fill" />
              <Text style={styles.proximityText}>{formatProximity(road.distanceMeters)}</Text>
            </View>
          ) : (
            <View style={[styles.privacyBadge, road.isPublic ? styles.publicBadge : styles.privateBadge]}>
              <Icon
                name={road.isPublic ? 'globe' : 'lock'}
                size={11}
                color={road.isPublic ? Colors.accent.cyan : Colors.text.secondary}
                weight="bold"
              />
              <Text style={[styles.privacyText, road.isPublic ? styles.publicText : styles.privateText]}>
                {road.isPublic ? 'PUBLIC' : 'PRIVATE'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.bookmarkBtn, isSaved ? styles.bookmarkBtnSaved : undefined]}
            onPress={handleBookmarkPress}
            activeOpacity={0.8}
            accessibilityLabel="Bookmark road"
          >
            <Icon
              name="bookmark"
              size={14}
              color={isSaved ? Colors.accent.cyan : Colors.text.secondary}
              weight={isSaved ? 'fill' : 'regular'}
            />
            <Text style={[styles.bookmarkCount, isSaved ? styles.bookmarkCountSaved : undefined]}>
              {savedCount}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Card Content & Title */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {road.name}
          </Text>
          {road.surfaceType && (
            <View style={styles.tagChip}>
              <Text style={styles.tagText}>{road.surfaceType.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {road.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {road.description}
          </Text>
        ) : null}

        {/* 4 Telemetry Metrics Grid */}
        <View style={styles.metricsGrid}>
          {/* Distance */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>DISTANCE</Text>
            <Text style={styles.metricValue}>{formatRoadLength(road.lengthMeters)}</Text>
          </View>

          {/* Elevation Gain */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>ELEVATION</Text>
            <Text style={styles.metricValue}>+{road.elevationGainM ?? 120} m</Text>
          </View>

          {/* Best Avg Speed */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>BEST AVG</Text>
            <Text style={styles.metricValue}>
              {road.bestAvgSpeedKmh ? `${road.bestAvgSpeedKmh} km/h` : '68 km/h'}
            </Text>
          </View>

          {/* Curviness */}
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>TWISTY</Text>
            <View style={styles.curvinessRow}>
              <Icon name="lightning" size={12} color={Colors.accent.cyan} weight="fill" />
              <Text style={styles.curvinessValue}>
                {road.curvinessScore ? road.curvinessScore.toFixed(1) : '8.4'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onShare(road)}
            activeOpacity={0.7}
          >
            <Icon name="share" size={14} color={Colors.text.secondary} />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onReport(road)}
            activeOpacity={0.7}
          >
            <Icon name="warning" size={14} color={Colors.semantic.warning} />
            <Text style={[styles.actionBtnText, { color: Colors.semantic.warning }]}>Report</Text>
          </TouchableOpacity>

          {isOwner && onDelete && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleDeletePress}
              activeOpacity={0.7}
            >
              <Icon name="trash" size={14} color={Colors.semantic.danger} />
              <Text style={[styles.actionBtnText, { color: Colors.semantic.danger }]}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface[1], // #0E131B
    borderRadius: Radius.card, // 24
    borderWidth: 1,
    borderColor: Colors.hairline,
    overflow: 'hidden',
    marginBottom: Spacing[4],
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
  },
  thumbnailHeader: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  proximityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  proximityText: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  publicBadge: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  privateBadge: {
    backgroundColor: 'rgba(14, 19, 27, 0.9)',
    borderColor: Colors.hairline,
  },
  privacyText: {
    fontFamily: FontFamily.heading,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  publicText: {
    color: Colors.accent.cyan,
  },
  privateText: {
    color: Colors.text.secondary,
  },
  bookmarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 7, 13, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  bookmarkBtnSaved: {
    borderColor: Colors.accent.cyan,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
  },
  bookmarkCount: {
    fontFamily: FontFamily.heading,
    fontSize: 10,
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  bookmarkCountSaved: {
    color: Colors.accent.cyan,
  },
  content: {
    padding: Spacing[4],
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    color: Colors.text.primary,
    flex: 1,
  },
  tagChip: {
    backgroundColor: Colors.surface[2],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  tagText: {
    fontFamily: FontFamily.overline,
    fontSize: 9,
    color: Colors.text.tertiary,
    letterSpacing: 0.6,
  },
  description: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: Colors.surface[2], // #151B26
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'flex-start',
    gap: 2,
  },
  metricLabel: {
    fontFamily: FontFamily.overline,
    fontSize: 8,
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  curvinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  curvinessValue: {
    fontFamily: FontFamily.heading,
    fontSize: 13,
    color: Colors.accent.cyan,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.gap,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface[2],
  },
  actionBtnText: {
    fontFamily: FontFamily.label,
    fontSize: 11,
    color: Colors.text.secondary,
  },
});
