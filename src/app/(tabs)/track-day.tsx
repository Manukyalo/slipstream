import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, MapPin, Navigation, X } from 'lucide-react-native';
import { useTracking } from '@/contexts/TrackingContext';
import { useVehicles } from '@/hooks/useVehicles';
import { useLapTimer } from '@/hooks/useLapTimer';
import {
  createTrack,
  fetchNearbyTracks,
  formatLapTime,
  lapDelta,
  type Track,
} from '@/services/trackDay';
import { Theme } from '@/constants/theme';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/design';

// ─── Track Selector ───────────────────────────────────────────────────────────

interface TrackSelectorProps {
  currentLon: number | null;
  currentLat: number | null;
  onSelect: (track: Track) => void;
  onDefineNew: () => void;
}

function TrackSelector({ currentLon, currentLat, onSelect, onDefineNew }: TrackSelectorProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!currentLon || !currentLat) return;
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        const results = await fetchNearbyTracks(currentLon, currentLat, 100_000);
        if (!cancelled) setTracks(results);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentLon, currentLat, refreshKey]);

  const load = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <View style={sel.root}>
      <View style={sel.headerRow}>
        <View>
          <Text style={sel.title}>Select Track</Text>
          <Text style={sel.sub}>Tracks within 100 km of your position</Text>
        </View>
        <Pressable
          style={({ pressed }) => [sel.defineBtn, pressed && sel.pressed]}
          onPress={onDefineNew}
        >
          <Text style={sel.defineBtnText}>+ Define New</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={sel.centered}>
          <ActivityIndicator color={Colors.accentCyan} />
        </View>
      ) : hasError ? (
        <View style={sel.centered}>
          <Text style={sel.emptyText}>Could not load tracks.</Text>
          <Pressable onPress={load} style={({ pressed }) => [sel.retryBtn, pressed && sel.pressed]}>
            <Text style={sel.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : tracks.length === 0 ? (
        <View style={sel.centered}>
          <Text style={sel.emptyIcon}>🏁</Text>
          <Text style={sel.emptyTitle}>No tracks nearby</Text>
          <Text style={sel.emptyText}>
            Drive to a circuit and define it — your track will be public so other drivers can use it.
          </Text>
          <Pressable
            style={({ pressed }) => [sel.defineBtn, sel.defineBtnLarge, pressed && sel.pressed]}
            onPress={onDefineNew}
          >
            <Text style={sel.defineBtnText}>Define This Track</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [sel.trackRow, pressed && sel.pressed]}
              onPress={() => onSelect(item)}
            >
              <View style={sel.trackRowLeft}>
                <Navigation size={16} strokeWidth={1.5} color={Theme.colors.signalCyan} />
              </View>
              <View style={sel.trackRowCenter}>
                <Text style={sel.trackName} numberOfLines={1}>{item.name}</Text>
                {item.locationName && (
                  <Text style={sel.trackLocation} numberOfLines={1}>{item.locationName}</Text>
                )}
              </View>
              <Text style={sel.trackDist}>
                {item.distanceMeters !== undefined
                  ? `${(item.distanceMeters / 1000).toFixed(1)} km`
                  : ''}
              </Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={sel.sep} />}
          contentContainerStyle={sel.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Define Track Flow ────────────────────────────────────────────────────────

interface DefineTrackProps {
  currentLat: number | null;
  currentLon: number | null;
  currentHeading: number | null;
  onDone: (track: Track) => void;
  onCancel: () => void;
}

type DefineStep = 'name' | 'start_finish' | 'sectors' | 'saving';

function DefineTrack({
  currentLat,
  currentLon,
  currentHeading,
  onDone,
  onCancel,
}: DefineTrackProps) {
  // step drives internal save flow — keep as ref since it's write-only from the render perspective
  const stepRef = useRef<DefineStep>('name');
  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [capturedHeading, setCapturedHeading] = useState<number | null>(null);
  const [sfPoint, setSfPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [sectors, setSectors] = useState<{ lat: number; lon: number; heading: number | null }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const captureStartFinish = () => {
    if (!currentLat || !currentLon) {
      Alert.alert('No GPS Fix', 'Wait for a GPS lock before setting the start/finish line.');
      return;
    }
    setSfPoint({ lat: currentLat, lon: currentLon });
    setCapturedHeading(currentHeading);
    stepRef.current = 'sectors';
  };

  const addSector = () => {
    if (!currentLat || !currentLon) {
      Alert.alert('No GPS Fix', 'Wait for a GPS lock before adding a sector.');
      return;
    }
    setSectors((prev) => [
      ...prev,
      { lat: currentLat, lon: currentLon, heading: currentHeading },
    ]);
  };

  const removeSector = (idx: number) => {
    setSectors((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveTrack = async () => {
    if (!sfPoint) return;
    setIsSaving(true);
    stepRef.current = 'saving';
    try {
      const track = await createTrack({
        name: name.trim(),
        locationName: locationName.trim() || undefined,
        startFinishPoint: { lon: sfPoint.lon, lat: sfPoint.lat },
        startFinishHeading: capturedHeading,
        sectorPoints: sectors.map((s, i) => ({
          sectorIndex: i,
          lon: s.lon,
          lat: s.lat,
          heading: s.heading ?? undefined,
        })),
        isPublic: true,
      });
      onDone(track);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save track.';
      Alert.alert('Save Failed', msg);
      stepRef.current = 'sectors';
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={def.root} contentContainerStyle={def.content} keyboardShouldPersistTaps="handled">
      <Text style={def.title}>Define Track</Text>
      <Text style={def.sub}>Drive around the circuit and tap to set each gate.</Text>

      {/* Step 1: Name */}
      <View style={def.section}>
        <Text style={def.sectionLabel}>Track name <Text style={def.required}>*</Text></Text>
        <TextInput
          style={def.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Nairobi Motor Sports Club"
          placeholderTextColor={Colors.textMuted}
          maxLength={100}
          returnKeyType="next"
        />
        <Text style={def.sectionLabel}>Venue / location</Text>
        <TextInput
          style={def.input}
          value={locationName}
          onChangeText={setLocationName}
          placeholder="e.g. Ngong Raceway, Nairobi"
          placeholderTextColor={Colors.textMuted}
          maxLength={100}
          returnKeyType="done"
        />
      </View>

      {/* Step 2: Start/Finish */}
      <View style={def.section}>
        <Text style={def.sectionLabel}>Start / finish line</Text>
        {sfPoint ? (
          <View style={def.capturedBadge}>
            <View style={def.capturedIconWrap}>
              <Check size={14} strokeWidth={2} color={Theme.colors.signalCyan} />
            </View>
            <View>
              <Text style={def.capturedText}>
                {sfPoint.lat.toFixed(6)}, {sfPoint.lon.toFixed(6)}
              </Text>
              {capturedHeading !== null && (
                <Text style={def.capturedSubText}>Heading: {capturedHeading.toFixed(1)}°</Text>
              )}
            </View>
            <Pressable
              onPress={() => { setSfPoint(null); stepRef.current = 'name'; }}
              style={({ pressed }) => [def.clearBtn, pressed && def.pressed]}
            >
              <Text style={def.clearBtnText}>Reset</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [def.captureBtn, pressed && def.pressed]}
            onPress={() => {
              if (!name.trim() || name.trim().length < 2) {
                Alert.alert('Name Required', 'Enter a track name before setting the start/finish line.');
                return;
              }
              captureStartFinish();
            }}
          >
            <MapPin size={14} strokeWidth={1.5} color={Colors.accentCyan} style={{ marginRight: 6 }} />
            <Text style={def.captureBtnText}>Set start/finish at current position</Text>
          </Pressable>
        )}
      </View>

      {/* Step 3: Sectors (optional) */}
      {sfPoint && (
        <View style={def.section}>
          <View style={def.sectorHeader}>
            <Text style={def.sectionLabel}>Sector splits <Text style={def.optional}>(optional)</Text></Text>
            <Pressable
              style={({ pressed }) => [def.addSectorBtn, pressed && def.pressed]}
              onPress={addSector}
            >
              <Text style={def.addSectorBtnText}>+ Add Here</Text>
            </Pressable>
          </View>
          {sectors.length === 0 ? (
            <Text style={def.sectorEmpty}>
              Drive to each sector point and tap + Add Here. Add sectors in order.
            </Text>
          ) : (
            sectors.map((s, i) => (
              <View key={i} style={def.sectorRow}>
                <Text style={def.sectorIcon}>S{i + 1}</Text>
                <Text style={def.sectorCoord}>
                  {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                </Text>
                <Pressable
                  onPress={() => removeSector(i)}
                  style={({ pressed }) => [def.clearBtn, pressed && def.pressed]}
                >
                  <X size={12} strokeWidth={2} color={Colors.accentRed} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      {/* Actions */}
      <View style={def.actions}>
        <Pressable
          style={({ pressed }) => [def.cancelBtn, pressed && def.pressed]}
          onPress={onCancel}
        >
          <Text style={def.cancelBtnText}>Cancel</Text>
        </Pressable>

        {sfPoint && !isSaving && (
          <Pressable
            style={({ pressed }) => [def.saveBtn, pressed && def.pressed]}
            onPress={saveTrack}
          >
            <Text style={def.saveBtnText}>Save Track</Text>
          </Pressable>
        )}

        {isSaving && (
          <View style={def.saveBtn}>
            <ActivityIndicator size="small" color={Colors.textInverse} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Live Session ─────────────────────────────────────────────────────────────

interface LiveSessionProps {
  track: Track;
  vehicleId: string | null;
  currentLat: number | null;
  currentLon: number | null;
  currentHeading: number | null;
  onEnd: (laps: import('@/services/trackDay').Lap[], bestIdx: number | null) => void;
}

function LiveSession({
  track,
  vehicleId,
  currentLat,
  currentLon,
  currentHeading,
  onEnd,
}: LiveSessionProps) {
  const { state, startSession, endSession } = useLapTimer({
    track,
    vehicleId,
    currentLat,
    currentLon,
    currentHeading,
    isActive: true,
  });

  useEffect(() => {
    startSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = () => {
    endSession();
    onEnd(state.completedLaps, state.bestLapIndex);
  };

  const bestMs = state.bestLapIndex !== null
    ? state.completedLaps[state.bestLapIndex]?.lapTimeMs ?? null
    : null;

  return (
    <View style={live.root}>
      {/* Header */}
      <View style={live.header}>
        <View style={{ flex: 1 }}>
          <Text style={live.trackName} numberOfLines={1}>{track.name}</Text>
          <Text style={live.sessionStatus}>
            {!state.hasStarted ? '⟳  Drive through start/finish to begin…' : `Lap ${state.completedLaps.length + 1}`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [live.endBtn, pressed && live.pressed]}
          onPress={handleEnd}
        >
          <Text style={live.endBtnText}>End</Text>
        </Pressable>
      </View>

      {/* Live Timer */}
      <View style={live.timerBox}>
        <Text style={live.timerText}>{formatLapTime(state.currentLapMs)}</Text>
        {bestMs !== null && (
          <Text style={live.bestLabel}>
            PB {formatLapTime(bestMs)}
          </Text>
        )}
      </View>

      {/* Sector splits in-progress */}
      {state.pendingSectors.length > 0 && (
        <View style={live.sectorsRow}>
          {state.pendingSectors.map((s) => (
            <View key={s.sectorIndex} style={live.sectorChip}>
              <Text style={live.sectorChipLabel}>S{s.sectorIndex + 1}</Text>
              <Text style={live.sectorChipTime}>{formatLapTime(s.splitMs)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Completed laps */}
      <FlatList
        data={state.completedLaps}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={
          state.completedLaps.length > 0 ? (
            <Text style={live.lapListHeader}>Completed laps</Text>
          ) : null
        }
        renderItem={({ item, index }) => {
          const isBest = index === state.bestLapIndex;
          return (
            <View style={[live.lapRow, isBest && live.lapRowBest]}>
              <Text style={[live.lapNum, isBest && live.lapBestText]}>
                {isBest ? 'Best' : `L${state.completedLaps.length - index}`}
              </Text>
              <Text style={[live.lapTime, isBest && live.lapBestText]}>
                {formatLapTime(item.lapTimeMs)}
              </Text>
              {bestMs !== null && !isBest && (
                <Text style={live.lapDelta}>
                  {lapDelta(item.lapTimeMs, bestMs)}
                </Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={live.lapList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Session Summary ──────────────────────────────────────────────────────────

interface SessionSummaryProps {
  laps: import('@/services/trackDay').Lap[];
  bestLapIndex: number | null;
  trackName: string;
  onDone: () => void;
}

function SessionSummary({ laps, bestLapIndex, trackName, onDone }: SessionSummaryProps) {
  const bestMs = bestLapIndex !== null ? laps[bestLapIndex]?.lapTimeMs ?? null : null;

  return (
    <ScrollView style={sum.root} contentContainerStyle={sum.content}>
      <Text style={sum.title}>Session Complete</Text>
      <Text style={sum.sub}>{trackName}</Text>

      <View style={sum.statsRow}>
        <View style={sum.statCell}>
          <Text style={sum.statValue}>{laps.length}</Text>
          <Text style={sum.statLabel}>Laps</Text>
        </View>
        <View style={sum.sep} />
        <View style={sum.statCell}>
          <Text style={sum.statValue}>{bestMs ? formatLapTime(bestMs) : '—'}</Text>
          <Text style={sum.statLabel}>Best Lap</Text>
        </View>
        <View style={sum.sep} />
        <View style={sum.statCell}>
          <Text style={sum.statValue}>
            {laps.length > 0 ? formatLapTime(Math.round(laps.reduce((a, l) => a + l.lapTimeMs, 0) / laps.length)) : '—'}
          </Text>
          <Text style={sum.statLabel}>Avg Lap</Text>
        </View>
      </View>

      {laps.map((lap, index) => {
        const isBest = index === bestLapIndex;
        return (
          <View key={lap.id} style={[sum.lapRow, isBest && sum.lapRowBest]}>
            <Text style={[sum.lapNum, isBest && sum.lapBestText]}>
              {isBest ? '✦ Best' : `Lap ${laps.length - index}`}
            </Text>
            <Text style={[sum.lapTime, isBest && sum.lapBestText]}>
              {formatLapTime(lap.lapTimeMs)}
            </Text>
            {bestMs !== null && !isBest && (
              <Text style={sum.lapDelta}>{lapDelta(lap.lapTimeMs, bestMs)}</Text>
            )}
          </View>
        );
      })}

      <Pressable
        style={({ pressed }) => [sum.doneBtn, pressed && sum.pressed]}
        onPress={onDone}
      >
        <Text style={sum.doneBtnText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Root Screen ──────────────────────────────────────────────────────────────

type ScreenMode = 'select' | 'define' | 'session' | 'summary';

export default function TrackDayScreen() {
  const { currentCoords, permissionGranted, requestPermissions } = useTracking();
  const { primaryVehicle } = useVehicles();

  const [mode, setMode] = useState<ScreenMode>('select');
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [sessionLaps, setSessionLaps] = useState<import('@/services/trackDay').Lap[]>([]);
  const [sessionBest, setSessionBest] = useState<number | null>(null);

  const currentLon = currentCoords?.[0] ?? null;
  const currentLat = currentCoords?.[1] ?? null;
  // Heading not exposed by TrackingContext — use null (heading check is optional)
  const currentHeading: number | null = null;

  useEffect(() => {
    if (!permissionGranted) {
      requestPermissions().catch(console.error);
    }
  }, [permissionGranted, requestPermissions]);

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track);
    setMode('session');
  };

  const handleSessionEnd = useCallback(
    (laps: import('@/services/trackDay').Lap[], bestIdx: number | null) => {
      setSessionLaps(laps);
      setSessionBest(bestIdx);
      setMode('summary');
    },
    [],
  );

  return (
    <View style={styles.root}>
      {/* Compact header — always visible */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Track Day</Text>
        <Text style={styles.headerSub}>
          {mode === 'select' && 'Lap timing · closed circuit'}
          {mode === 'define' && 'Define a new circuit'}
          {mode === 'session' && selectedTrack?.name}
          {mode === 'summary' && 'Session summary'}
        </Text>
      </View>

      {mode === 'select' && (
        <TrackSelector
          currentLon={currentLon}
          currentLat={currentLat}
          onSelect={handleSelectTrack}
          onDefineNew={() => setMode('define')}
        />
      )}

      {mode === 'define' && (
        <DefineTrack
          currentLat={currentLat}
          currentLon={currentLon}
          currentHeading={currentHeading}
          onDone={(track) => { setSelectedTrack(track); setMode('session'); }}
          onCancel={() => setMode('select')}
        />
      )}

      {mode === 'session' && selectedTrack && (
        <LiveSession
          track={selectedTrack}
          vehicleId={primaryVehicle?.id ?? null}
          currentLat={currentLat}
          currentLon={currentLon}
          currentHeading={currentHeading}
          onEnd={handleSessionEnd}
        />
      )}

      {mode === 'summary' && selectedTrack && (
        <SessionSummary
          laps={sessionLaps}
          bestLapIndex={sessionBest}
          trackName={selectedTrack.name}
          onDone={() => { setSelectedTrack(null); setMode('select'); }}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgBase },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 24,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.h1,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

// Track Selector styles
const sel = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },
  sub: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted, marginTop: 2 },
  defineBtn: {
    backgroundColor: Colors.accentCyanDim,
    borderWidth: 1,
    borderColor: Colors.accentCyan,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  defineBtnLarge: { marginTop: Spacing.md },
  defineBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.caption, color: Colors.accentCyan },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted, textAlign: 'center', maxWidth: 260 },
  retryBtn: { borderWidth: 1, borderColor: Colors.accentCyan, borderRadius: Radius.sm, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
  retryText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.accentCyan },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  trackRowLeft: { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center' },
  trackRowIcon: { fontSize: 18 },
  trackRowCenter: { flex: 1 },
  trackName: { fontFamily: FontFamily.semiBold, fontSize: FontSize.label, color: Colors.textPrimary },
  trackLocation: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted, marginTop: 1 },
  trackDist: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted },
  sep: { height: 1, backgroundColor: Colors.borderSubtle, marginHorizontal: Spacing.base },
  listContent: { paddingBottom: Spacing['4xl'] },
  pressed: { opacity: 0.7 },
});

// Define Track styles
const def = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgBase },
  content: { padding: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.lg },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.h2, color: Colors.textPrimary },
  sub: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionLabel: { fontFamily: Theme.fonts.bodyMedium, fontSize: 12, color: Theme.colors.textMuted, marginBottom: 2 },
  required: { color: Theme.colors.signalCyan },
  optional: { fontFamily: Theme.fonts.bodyRegular, fontSize: 11, color: Theme.colors.textMuted },
  input: {
    backgroundColor: Colors.bgSurface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontFamily: FontFamily.regular, fontSize: FontSize.body, color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  captureBtn: {
    backgroundColor: Colors.accentCyanDim, borderWidth: 1, borderColor: Colors.accentCyan,
    borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center',
  },
  captureBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.accentCyan },
  capturedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgSurface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.accentGreen,
    padding: Spacing.md,
  },
  capturedIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.accentGreen + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  capturedText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.accentGreen },
  capturedSubText: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted },
  clearBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
  clearBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.accentRed },
  sectorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addSectorBtn: {
    backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.xs, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
  },
  addSectorBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.caption, color: Colors.textSecondary },
  sectorEmpty: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted, lineHeight: 17 },
  sectorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  sectorIcon: { fontFamily: FontFamily.bold, fontSize: FontSize.caption, color: Colors.accentOrange, width: 24 },
  sectorCoord: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textSecondary },
  saveBtn: {
    flex: 1, backgroundColor: Colors.accentCyan, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
  },
  saveBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.textInverse },
  pressed: { opacity: 0.7 },
});

// Live Session styles
const live = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  trackName: { fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary },
  sessionStatus: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted, marginTop: 2 },
  endBtn: {
    backgroundColor: Colors.accentRedDim, borderWidth: 1, borderColor: Colors.accentRed,
    borderRadius: Radius.sm, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md,
  },
  endBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.caption, color: Colors.accentRed },
  timerBox: {
    alignItems: 'center', paddingVertical: Spacing['3xl'],
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  timerText: {
    fontFamily: Theme.fonts.numberBold, fontSize: 56, color: Colors.accentCyan,
    letterSpacing: 1, fontVariant: ['tabular-nums'],
  },
  bestLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted, marginTop: Spacing.xs },
  sectorsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectorChip: {
    backgroundColor: Colors.bgSurface, borderRadius: Radius.sm, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  sectorChipLabel: { fontFamily: FontFamily.semiBold, fontSize: FontSize.caption, color: Colors.accentOrange },
  sectorChipTime: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textSecondary },
  lapList: { padding: Spacing.base, paddingBottom: Spacing['4xl'] },
  lapListHeader: {
    fontFamily: Theme.fonts.bodyMedium,
    fontSize: 11,
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  lapRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle, gap: Spacing.md,
  },
  lapRowBest: { backgroundColor: 'rgba(0,212,255,0.06)', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm },
  lapNum: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textMuted, width: 32 },
  lapTime: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  lapBestText: { color: Colors.accentCyan },
  lapDelta: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.accentOrange },
  pressed: { opacity: 0.7 },
});

// Summary styles
const sum = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing['4xl'], gap: Spacing.lg },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.h2, color: Colors.textPrimary },
  sub: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted },
  statsRow: {
    flexDirection: 'row', alignItems: 'stretch',
    backgroundColor: Colors.bgSurface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.base,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  sep: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },
  statValue: { fontFamily: FontFamily.bold, fontSize: FontSize.h2, color: Colors.accentCyan },
  statLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.textMuted },
  lapRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle, gap: Spacing.md,
  },
  lapRowBest: {
    backgroundColor: 'rgba(0,212,255,0.06)', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, borderBottomWidth: 0, marginBottom: 1,
  },
  lapNum: { fontFamily: FontFamily.medium, fontSize: FontSize.label, color: Colors.textMuted, width: 64 },
  lapTime: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.body, color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  lapBestText: { color: Colors.accentCyan },
  lapDelta: { fontFamily: FontFamily.regular, fontSize: FontSize.caption, color: Colors.accentOrange },
  doneBtn: {
    backgroundColor: Colors.accentCyan, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.xl,
  },
  doneBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.label, color: Colors.textInverse },
  pressed: { opacity: 0.7 },
});
