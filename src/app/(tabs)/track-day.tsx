/**
 * Circuit — Lap Timing & Track Day Experience
 *
 * Phase 5 Specifications:
 *  - Single name "Circuit" across all headings, copy, and buttons
 *  - Inside ScreenContainer with large collapsing title "Circuit" clearing status bar
 *  - Track list cards: outline thumbnail, name, distance from you, length, best lap, lap count
 *  - One "Define new track" button: in header when list has items, and as only CTA in empty state
 *  - 4-step Define flow: pick location, start/finish line with heading handle, optional sectors, name & visibility (default private)
 *  - Live lap timing screen: Metric XL lap time, anti-flicker delta pill, sector splits, best lap in violet, haptics & sound
 *  - Safety notice: Closed circuits only
 *  - Skeleton loading & error state with Retry
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, Radius, Spacing } from '@/constants/theme';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CircuitCard } from '@/components/circuit/CircuitCard';
import { CircuitCardSkeleton } from '@/components/circuit/CircuitCardSkeleton';
import { DefineCircuitModal } from '@/components/circuit/DefineCircuitModal';
import { LiveLapScreen } from '@/components/circuit/LiveLapScreen';
import { useTracking } from '@/contexts/TrackingContext';
import { useLapTimer } from '@/hooks/useLapTimer';
import {
  fetchNearbyTracks,
  deleteTrack,
  type Track,
} from '@/services/trackDay';
import { toUserMessage } from '@/utils/toUserMessage';

export default function CircuitScreen({ isEmbedded = false }: { isEmbedded?: boolean }) {
  const { currentCoords, heading } = useTracking();
  const currentLon = currentCoords?.[0] ?? null;
  const currentLat = currentCoords?.[1] ?? null;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Live Timing Session
  const [activeCircuit, setActiveCircuit] = useState<Track | null>(null);

  // Modal State
  const [showDefineModal, setShowDefineModal] = useState<boolean>(false);

  // Live Lap Timer Hook
  const { state: lapState } = useLapTimer({
    track: activeCircuit,
    currentLat,
    currentLon,
    currentHeading: heading,
    isActive: activeCircuit !== null,
  });

  const loadTracks = useCallback(async () => {
    try {
      setErrorMsg(null);
      // If no GPS coordinates yet, use fallback or radius query
      const lon = currentLon ?? 0;
      const lat = currentLat ?? 0;
      const data = await fetchNearbyTracks(lon, lat, 250_000);
      setTracks(data);
    } catch (err) {
      setErrorMsg(toUserMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentLon, currentLat]);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (!isCancelled) {
        await loadTracks();
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [loadTracks]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadTracks();
  }, [loadTracks]);

  const handleDeleteCircuit = (track: Track) => {
    Alert.alert(
      'Delete Circuit',
      `Are you sure you want to delete "${track.name}"? This will remove all associated laps.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrack(track.id);
              setTracks((prev) => prev.filter((t) => t.id !== track.id));
              try {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}
            } catch (err) {
              Alert.alert('Error', toUserMessage(err));
            }
          },
        },
      ],
    );
  };

  const handleCircuitCreated = (newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev]);
  };

  // If in active timing session, render full-screen LiveLapScreen
  if (activeCircuit) {
    return (
      <LiveLapScreen
        track={activeCircuit}
        lapState={lapState}
        onExit={() => {
          setActiveCircuit(null);
          // Refresh list to update persisted best laps and lap counts
          void loadTracks();
        }}
      />
    );
  }

  return (
    <ScreenContainer
      title="Circuit"
      largeTitle
      scrollable
      skipTopInset={isEmbedded}
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.cyan}
          />
        ),
      }}
    >
      <View style={styles.container}>
        {/* Closed Circuit Safety Banner (Task 5) */}
        <View style={styles.safetyNotice}>
          <Icon name="warning" size={14} color={Colors.semantic.warning} weight="bold" />
          <Text style={styles.safetyNoticeText}>
            CLOSED CIRCUITS ONLY — Lap timing is intended exclusively for closed race circuits and private track facilities.
          </Text>
        </View>

        {/* Top Header Action: One "Define new track" button when items exist */}
        {tracks.length > 0 && (
          <View style={styles.topBar}>
            <View>
              <Text style={styles.sectionSubtitle}>NEARBY RACETRACKS</Text>
              <Text style={styles.sectionCaption}>
                {tracks.length} {tracks.length === 1 ? 'circuit' : 'circuits'} within range
              </Text>
            </View>

            <TouchableOpacity
              style={styles.defineHeaderBtn}
              onPress={() => setShowDefineModal(true)}
              activeOpacity={0.8}
            >
              <Icon name="plus" size={14} color={Colors.bg.base} weight="bold" />
              <Text style={styles.defineHeaderBtnText}>Define New Track</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content States */}
        {loading && !refreshing ? (
          <View style={styles.skeletonList}>
            <CircuitCardSkeleton />
            <CircuitCardSkeleton />
            <CircuitCardSkeleton />
          </View>
        ) : errorMsg ? (
          <ErrorState message={errorMsg} onRetry={loadTracks} style={styles.stateContainer} />
        ) : tracks.length === 0 ? (
          <EmptyState
            icon="flag"
            iconColor="cyan"
            title="No circuits nearby"
            description="Define a start/finish line and optional split sectors on any closed motorsport circuit to time your laps."
            action={{
              label: 'Define New Track',
              onPress: () => setShowDefineModal(true),
            }}
            style={styles.stateContainer}
          />
        ) : (
          <View style={styles.trackList}>
            {tracks.map((track) => (
              <CircuitCard
                key={track.id}
                track={track}
                isOwner={true}
                onSelect={(t) => setActiveCircuit(t)}
                onDelete={handleDeleteCircuit}
              />
            ))}
          </View>
        )}
      </View>

      {/* Define Circuit Modal */}
      <DefineCircuitModal
        visible={showDefineModal}
        currentLon={currentLon}
        currentLat={currentLat}
        onClose={() => setShowDefineModal(false)}
        onCreated={handleCircuitCreated}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing[10],
    gap: Spacing[4],
  },
  safetyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  safetyNoticeText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: 11,
    color: Colors.semantic.warning,
    lineHeight: 16,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sectionSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
  },
  sectionCaption: {
    fontFamily: FontFamily.metric,
    fontSize: 12,
    color: Colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  defineHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  defineHeaderBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.bg.base,
  },
  skeletonList: {
    gap: Spacing[3],
  },
  trackList: {
    gap: Spacing[2],
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[8],
    paddingHorizontal: Spacing[5],
    backgroundColor: Colors.surface['1'],
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.hairline,
    gap: Spacing[3],
    marginTop: Spacing[4],
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  emptyDescription: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent.cyan,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyCtaText: {
    fontFamily: FontFamily.heading,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.bg.base,
  },
  errorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing[6],
    paddingHorizontal: Spacing[4],
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    gap: 12,
    marginTop: Spacing[4],
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.semantic.danger,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.semantic.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  retryBtnText: {
    fontFamily: FontFamily.heading,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.bg.base,
  },
  stateContainer: {
    marginVertical: Spacing[6],
  },
});
