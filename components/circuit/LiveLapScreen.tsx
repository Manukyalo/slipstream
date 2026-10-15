/**
 * LiveLapScreen — High-precision Live Lap Timing Dashboard
 *
 * Specifications (Phase 5 Task 4 & 5):
 *  - Safety notice: Closed circuits only banner
 *  - Current lap in Metric XL (Space Grotesk, tabular figures)
 *  - Anti-flicker live delta pill (green negative, red positive)
 *  - Sector split row (S1, S2, S3)
 *  - Lap list with best lap highlighted in violet (#8B5CF6)
 *  - Haptic feedback and crossing sound (handled by useLapTimer)
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import {
  formatLapTime,
  lapDelta,
  type Track,
} from '@/services/trackDay';
import type { LiveLapState } from '@/hooks/useLapTimer';

interface LiveLapScreenProps {
  track: Track;
  lapState: LiveLapState;
  onExit: () => void;
}

export function LiveLapScreen({
  track,
  lapState,
  onExit,
}: LiveLapScreenProps) {
  const {
    currentLapMs,
    pendingSectors,
    completedLaps,
    bestLapIndex,
    hasStarted,
  } = lapState;

  const handleExit = () => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    onExit();
  };

  // Best lap reference time in ms
  const bestLapMs = useMemo(() => {
    if (bestLapIndex !== null && completedLaps[bestLapIndex]) {
      return completedLaps[bestLapIndex].lapTimeMs;
    }
    return track.bestLapMs ?? null;
  }, [bestLapIndex, completedLaps, track.bestLapMs]);

  // Anti-flicker Delta Calculation:
  // Evaluates relative pace against personal best without oscillating every frame
  const deltaInfo = useMemo(() => {
    if (!hasStarted) {
      return { text: 'WAITING FOR GATE', color: Colors.text.tertiary, bg: 'rgba(154, 164, 178, 0.1)' };
    }
    if (!bestLapMs) {
      return { text: 'OUT LAP', color: Colors.accent.cyan, bg: 'rgba(34, 211, 238, 0.12)' };
    }

    const diff = currentLapMs - bestLapMs;
    if (diff < 0) {
      // Still ahead of best lap mark
      const deltaSec = (diff / 1000).toFixed(2);
      return {
        text: `${deltaSec}s`,
        color: Colors.semantic.success,
        bg: 'rgba(34, 197, 94, 0.15)',
      };
    } else {
      const deltaSec = `+${(diff / 1000).toFixed(2)}`;
      return {
        text: `${deltaSec}s`,
        color: Colors.semantic.danger,
        bg: 'rgba(244, 63, 94, 0.15)',
      };
    }
  }, [hasStarted, bestLapMs, currentLapMs]);

  const currentLapFormatted = formatLapTime(currentLapMs);
  // Split into minutes:seconds and milliseconds for styling
  const [mainTime, msPart] = currentLapFormatted.split('.');

  return (
    <View style={styles.root}>
      {/* ── Safety Notice Strip ── */}
      <View style={styles.safetyStrip}>
        <Icon name="warning" size={13} color={Colors.semantic.warning} weight="bold" />
        <Text style={styles.safetyText}>
          CLOSED CIRCUIT ONLY — Lap timing is strictly forbidden on public roads.
        </Text>
      </View>

      {/* ── Top Header Bar ── */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={styles.trackName} numberOfLines={1}>
            {track.name}
          </Text>
          <View style={styles.statusIndicator}>
            <View style={[styles.statusDot, hasStarted ? styles.statusDotActive : undefined]} />
            <Text style={styles.statusText}>
              {hasStarted ? 'TIMING ACTIVE' : 'APPROACHING LINE'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.8}>
          <Icon name="close" size={16} color={Colors.text.primary} />
          <Text style={styles.exitBtnText}>End Session</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {/* ── Metric XL Current Lap Display ── */}
        <Card style={styles.timerCard}>
          <Text style={styles.timerLabel}>CURRENT LAP</Text>

          <View style={styles.metricXLRow}>
            <Text style={styles.metricXLMain}>{mainTime}</Text>
            <Text style={styles.metricXLSub}>.{msPart ?? '000'}</Text>
          </View>

          {/* Delta Pill (anti-flicker) */}
          <View style={[styles.deltaPill, { backgroundColor: deltaInfo.bg }]}>
            <Text style={[styles.deltaPillText, { color: deltaInfo.color }]}>
              {deltaInfo.text}
            </Text>
          </View>
        </Card>

        {/* ── Sector Split Row ── */}
        <View style={styles.sectorRow}>
          {[0, 1, 2].map((idx) => {
            const split = pendingSectors.find((s) => s.sectorIndex === idx + 1);
            const splitStr = split ? `${(split.splitMs / 1000).toFixed(2)}s` : '--.--';
            return (
              <View key={idx} style={styles.sectorBox}>
                <Text style={styles.sectorLabel}>SECTOR {idx + 1}</Text>
                <Text style={[styles.sectorTime, split ? styles.sectorTimeActive : undefined]}>
                  {splitStr}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Completed Laps Section ── */}
        <View style={styles.lapsHeaderRow}>
          <Text style={styles.lapsSectionTitle}>COMPLETED LAPS</Text>
          <Text style={styles.lapsCountBadge}>{completedLaps.length} logged</Text>
        </View>

        {completedLaps.length === 0 ? (
          <Card style={styles.emptyLapsCard}>
            <Icon name="flag" size={24} color={Colors.text.tertiary} weight="duotone" />
            <Text style={styles.emptyLapsText}>
              Cross the start/finish line to trigger your first lap.
            </Text>
          </Card>
        ) : (
          <View style={styles.lapList}>
            {completedLaps.map((lap, idx) => {
              const isBest = idx === bestLapIndex;
              const lapNum = completedLaps.length - idx;
              const deltaStr = bestLapMs ? lapDelta(lap.lapTimeMs, bestLapMs) : null;

              return (
                <View
                  key={lap.id || idx}
                  style={[styles.lapRow, isBest ? styles.bestLapRow : undefined]}
                >
                  <View style={styles.lapNumberWrap}>
                    <Text style={[styles.lapNumberText, isBest ? styles.bestVioletText : undefined]}>
                      L{lapNum}
                    </Text>
                  </View>

                  <Text style={[styles.lapTimeText, isBest ? styles.bestVioletText : undefined]}>
                    {formatLapTime(lap.lapTimeMs)}
                  </Text>

                  {/* Delta to Best */}
                  <View style={styles.lapDeltaWrap}>
                    {isBest ? (
                      <View style={styles.purpleBestBadge}>
                        <Text style={styles.purpleBestText}>BEST</Text>
                      </View>
                    ) : deltaStr ? (
                      <Text style={styles.lapDeltaText}>{deltaStr}s</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg.base,
  },
  safetyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingVertical: 8,
    paddingHorizontal: Spacing.screen,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.25)',
  },
  safetyText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.semantic.warning,
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  headerTitles: {
    flex: 1,
    gap: 4,
  },
  trackName: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.text.tertiary,
  },
  statusDotActive: {
    backgroundColor: Colors.semantic.success,
  },
  statusText: {
    fontFamily: FontFamily.metric,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface['2'],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  exitBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screen,
    gap: Spacing[4],
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: Spacing[6],
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    gap: 12,
  },
  timerLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 1.2,
  },
  metricXLRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  metricXLMain: {
    fontFamily: FontFamily.heading,
    fontSize: 56,
    fontWeight: '700',
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  metricXLSub: {
    fontFamily: FontFamily.heading,
    fontSize: 28,
    fontWeight: '600',
    color: Colors.accent.cyan,
    fontVariant: ['tabular-nums'],
  },
  deltaPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  deltaPillText: {
    fontFamily: FontFamily.metric,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sectorBox: {
    flex: 1,
    backgroundColor: Colors.surface['2'],
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  sectorLabel: {
    fontFamily: FontFamily.body,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 0.5,
  },
  sectorTime: {
    fontFamily: FontFamily.metric,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  sectorTimeActive: {
    color: Colors.accent.cyan,
    fontWeight: '700',
  },
  lapsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  lapsSectionTitle: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 1,
  },
  lapsCountBadge: {
    fontFamily: FontFamily.metric,
    fontSize: 11,
    color: Colors.text.secondary,
  },
  emptyLapsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[6],
    paddingHorizontal: Spacing[4],
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    gap: 10,
  },
  emptyLapsText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  lapList: {
    gap: 8,
  },
  lapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface['2'],
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  // Violet highlight for personal best lap (Task 4)
  bestLapRow: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: '#8B5CF6',
  },
  bestVioletText: {
    color: '#A78BFA',
    fontWeight: '700',
  },
  lapNumberWrap: {
    width: 36,
  },
  lapNumberText: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  lapTimeText: {
    fontFamily: FontFamily.metric,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  lapDeltaWrap: {
    width: 60,
    alignItems: 'flex-end',
  },
  lapDeltaText: {
    fontFamily: FontFamily.metric,
    fontSize: 12,
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  purpleBestBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  purpleBestText: {
    fontFamily: FontFamily.metric,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
