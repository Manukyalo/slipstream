/**
 * TrackingContext — Slipstream Drive Recording Engine
 *
 * State machine:
 *   idle → gps-wait → recording ⇆ pit-stopped → saving → idle
 *
 * Key invariants:
 *  - Start requires accuracy < 30 m before state transitions to "recording"
 *  - Elapsed time and distance EXCLUDE pit stop intervals
 *  - Background location task keeps running during pit stops so the foreground
 *    subscription (which drives the UI speedometer) is the only one paused
 *  - Pit stop state is persisted to SQLite; survives app kill/restart
 *  - All trip data is saved with the enriched payload (pit_stops, route_points,
 *    start_latlng, end_latlng, moving_time_s, etc.)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { saveTrip } from '@/services/trips';
import { enqueueOrExec, generateClientId } from '@/services/offlineQueue';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicleContext } from '@/contexts/VehicleContext';
import {
  type GpsSample,
  type PitStopRecord,
  type PitStopInterval,
  type TripMetrics,
  computeTripMetrics,
  msToKmh,
  samplesToGeoJsonLine,
  buildRoutePoints,
  filterNoisySamples,
  douglasPeucker,
} from '@/utils/telemetry';
import {
  savePitStop,
  loadActivePitStop,
  clearPitStop,
  updatePitStopTag,
} from '@/utils/pitStopStore';
import type { FeatureCollection, LineString } from 'geojson';
import type { PitStopTag } from '@/utils/telemetry';

export const LOCATION_TRACKING_TASK = 'SLIPSTREAM_BACKGROUND_LOCATION_TASK';

// GPS accuracy threshold for starting a drive
const GPS_START_ACCURACY_M = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Global mutable buffers (module scope — survive context re-renders)
// ─────────────────────────────────────────────────────────────────────────────

let globalSamplesBuffer: GpsSample[] = [];
let onSampleListeners: ((sample: GpsSample) => void)[] = [];

// Background task — defined once at module level
if (!TaskManager.isTaskDefined(LOCATION_TRACKING_TASK)) {
  TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[TrackingTask] Background error:', error);
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      if (locations?.length) {
        for (const loc of locations) {
          const sample: GpsSample = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: Math.max(0, loc.coords.speed ?? 0),
            timestamp: loc.timestamp,
            accuracy: loc.coords.accuracy ?? undefined,
          };
          globalSamplesBuffer.push(sample);
          onSampleListeners.forEach((l) => l(sample));
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Context types
// ─────────────────────────────────────────────────────────────────────────────

export type TrackingPhase =
  | 'idle'
  | 'gps-wait'   // permission granted, waiting for accuracy < 30 m
  | 'recording'
  | 'pit-stopped'
  | 'saving';

export interface TrackingContextValue {
  phase: TrackingPhase;
  /** Convenience aliases */
  isTracking: boolean;
  isPitStopped: boolean;
  isSaving: boolean;
  isGpsWaiting: boolean;

  currentSpeedKmh: number;
  topSpeedKmh: number;
  /** Moving elapsed (excludes pit stop time) */
  elapsedSeconds: number;
  /** Pit stop running timer in seconds */
  pitStopElapsedSeconds: number;
  distanceMeters: number;
  samples: GpsSample[];
  routeGeoJson: FeatureCollection<LineString>;
  currentCoords: [number, number] | null;
  gpsAccuracy: number | null;
  heading: number | null;
  startCoords: [number, number] | null;
  pitStops: PitStopRecord[];
  currentPitStopTag: PitStopTag | null;

  permissionGranted: boolean;
  requestPermissions: () => Promise<boolean>;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<TripMetrics | null>;
  pauseTracking: (tag?: PitStopTag) => Promise<void>;
  resumeTracking: () => Promise<void>;
  setCurrentPitStopTag: (tag: PitStopTag) => Promise<void>;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeVehicleId, primaryVehicle } = useVehicleContext();

  // Phase state machine
  const [phase, setPhase] = useState<TrackingPhase>('idle');

  // Live telemetry
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [topSpeedKmh, setTopSpeedKmh] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pitStopElapsedSeconds, setPitStopElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [pitStops, setPitStops] = useState<PitStopRecord[]>([]);
  const [currentPitStopTag, setCurrentPitStopTagState] = useState<PitStopTag | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Stable refs
  const startTimeRef         = useRef<number | null>(null);
  const movingStartRef       = useRef<number | null>(null); // time when we last resumed moving
  const activeVehicleIdRef   = useRef<string | null>(null);
  const currentTripKeyRef    = useRef<string | null>(null);
  const pitStopsRef          = useRef<PitStopRecord[]>([]);
  const pitStopIntervalsRef  = useRef<PitStopInterval[]>([]);
  const pitStopStartMsRef    = useRef<number | null>(null);
  const accumulatedMovingMs  = useRef(0); // moving ms accumulated before current segment
  const lastSampleRef        = useRef<GpsSample | null>(null);

  // Subscriptions / timers
  const foregroundSubRef = useRef<Location.LocationSubscription | null>(null);
  const idleSubRef       = useRef<Location.LocationSubscription | null>(null);
  const movingTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pitTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Computed convenience booleans ──────────────────────────────────────────
  const isTracking   = phase === 'recording' || phase === 'pit-stopped';
  const isPitStopped = phase === 'pit-stopped';
  const isSaving     = phase === 'saving';
  const isGpsWaiting = phase === 'gps-wait';

  // ── GPS permission + idle location watch ───────────────────────────────────

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setPermissionGranted(false);
        return false;
      }
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      setPermissionGranted(true);

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (current) {
        setCurrentCoords([current.coords.longitude, current.coords.latitude]);
        setGpsAccuracy(current.coords.accuracy ?? null);
        if (current.coords.heading != null && current.coords.heading >= 0) {
          setHeading(current.coords.heading);
        }
      }
      return bgStatus === 'granted';
    } catch (err) {
      console.warn('[TrackingContext] Permission request error:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  // Idle position subscription (not recording)
  useEffect(() => {
    let mounted = true;
    if (permissionGranted && phase === 'idle') {
      Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 1500, distanceInterval: 2 },
        (loc) => {
          if (!mounted) return;
          setCurrentCoords([loc.coords.longitude, loc.coords.latitude]);
          setGpsAccuracy(loc.coords.accuracy ?? null);
          if (loc.coords.heading != null && loc.coords.heading >= 0) {
            setHeading(loc.coords.heading);
          }
        },
      )
        .then((sub) => {
          if (!mounted) sub.remove();
          else idleSubRef.current = sub;
        })
        .catch((e) => console.warn('[TrackingContext] Idle watch error:', e));
    }
    return () => {
      mounted = false;
      idleSubRef.current?.remove();
      idleSubRef.current = null;
    };
  }, [permissionGranted, phase]);

  // Restore pit stop if app was killed mid-pause
  useEffect(() => {
    loadActivePitStop().then((saved) => {
      if (saved && currentTripKeyRef.current === saved.tripKey) {
        // App was killed during a pit stop — restore state
        pitStopStartMsRef.current = saved.startedMs;
        setCurrentPitStopTagState(saved.tag);
        setPhase('pit-stopped');
        startPitTimer(saved.startedMs);
      }
    });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sample listener ─────────────────────────────────────────────────────────

  const handleNewSample = useCallback((sample: GpsSample) => {
    lastSampleRef.current = sample;
    const kmh = msToKmh(sample.speed);
    setCurrentSpeedKmh(kmh);
    setCurrentCoords([sample.longitude, sample.latitude]);
    setTopSpeedKmh((prev) => Math.max(prev, kmh));
    setSamples((prev) => [...prev, sample]);
  }, []);

  useEffect(() => {
    onSampleListeners.push(handleNewSample);
    return () => {
      onSampleListeners = onSampleListeners.filter((l) => l !== handleNewSample);
    };
  }, [handleNewSample]);

  // ── Derived state: live distance (updated on each new sample) ───────────────
  useEffect(() => {
    setSamples((prev) => {
      if (prev.length < 2) return prev;
      // Recalculate from all samples minus pit stop intervals
      // This is O(n) but samples count is bounded; runs on each sample push
      const intervals = pitStopIntervalsRef.current;
      let total = 0;
      const active = filterNoisySamples(prev).filter(
        (s) => !intervals.some((p) => s.timestamp >= p.startMs && s.timestamp <= p.endMs),
      );
      for (let i = 1; i < active.length; i++) {
        const d =
          Math.hypot(
            (active[i].latitude  - active[i - 1].latitude)  * 111_320,
            (active[i].longitude - active[i - 1].longitude) *
              111_320 *
              Math.cos((active[i].latitude * Math.PI) / 180),
          );
        if (d < 150) total += d;
      }
      setDistanceMeters(Number(total.toFixed(1)));
      return prev; // no mutation — just a read
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples]);

  // ── Timers ──────────────────────────────────────────────────────────────────

  function startMovingTimer() {
    stopMovingTimer();
    movingStartRef.current = Date.now();
    movingTimerRef.current = setInterval(() => {
      if (movingStartRef.current !== null) {
        const segmentMs = Date.now() - movingStartRef.current;
        setElapsedSeconds(Math.floor((accumulatedMovingMs.current + segmentMs) / 1000));
      }
    }, 1000);
  }

  function stopMovingTimer() {
    if (movingTimerRef.current) {
      clearInterval(movingTimerRef.current);
      movingTimerRef.current = null;
    }
    if (movingStartRef.current !== null) {
      accumulatedMovingMs.current += Date.now() - movingStartRef.current;
      movingStartRef.current = null;
    }
  }

  function startPitTimer(fromMs: number) {
    stopPitTimer();
    pitTimerRef.current = setInterval(() => {
      setPitStopElapsedSeconds(Math.floor((Date.now() - fromMs) / 1000));
    }, 1000);
  }

  function stopPitTimer() {
    if (pitTimerRef.current) {
      clearInterval(pitTimerRef.current);
      pitTimerRef.current = null;
    }
    setPitStopElapsedSeconds(0);
  }

  // ── Start tracking ──────────────────────────────────────────────────────────

  const startTracking = async (): Promise<void> => {
    if (phase !== 'idle') return;

    // Tear down idle watcher
    idleSubRef.current?.remove();
    idleSubRef.current = null;

    // Reset all state
    globalSamplesBuffer = [];
    setSamples([]);
    setCurrentSpeedKmh(0);
    setTopSpeedKmh(0);
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setStartCoords(null);
    setPitStops([]);
    pitStopsRef.current = [];
    pitStopIntervalsRef.current = [];
    accumulatedMovingMs.current = 0;

    setPhase('gps-wait');

    const tripKey = generateClientId();
    currentTripKeyRef.current = tripKey;
    activeVehicleIdRef.current = activeVehicleId ?? primaryVehicle?.id ?? null;
    startTimeRef.current = Date.now();

    // Subscribe to foreground location — wait for first good fix
    let startMarkerDropped = false;

    foregroundSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc) => {
        const accuracy = loc.coords.accuracy ?? 999;

        setGpsAccuracy(accuracy);
        if (loc.coords.heading != null && loc.coords.heading >= 0) {
          setHeading(loc.coords.heading);
        }

        const sample: GpsSample = {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed:     Math.max(0, loc.coords.speed ?? 0),
          timestamp: loc.timestamp,
          accuracy,
        };

        // Transition to recording on first good fix
        if (!startMarkerDropped && accuracy <= GPS_START_ACCURACY_M) {
          startMarkerDropped = true;
          setStartCoords([loc.coords.longitude, loc.coords.latitude]);
          setPhase('recording');
          startTimeRef.current = Date.now(); // reset timer from first good fix
          startMovingTimer();
        }

        if (startMarkerDropped) {
          globalSamplesBuffer.push(sample);
          handleNewSample(sample);
        }
      },
    );

    // Start background task (keeps running screen-off and during pit stops)
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 3,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Slipstream Recording',
            notificationBody: 'Drive telemetry is being recorded.',
            notificationColor: '#22D3EE',
          },
        });
      }
    } catch (err) {
      console.warn('[TrackingContext] Failed to start background task:', err);
    }
  };

  // ── Pause (pit stop) ────────────────────────────────────────────────────────

  const pauseTracking = async (tag?: PitStopTag): Promise<void> => {
    if (phase !== 'recording') return;

    const now = Date.now();
    const loc = lastSampleRef.current;

    stopMovingTimer();
    setPhase('pit-stopped');

    // Pause foreground subscription — background task stays alive
    foregroundSubRef.current?.remove();
    foregroundSubRef.current = null;

    const pitId = generateClientId();
    pitStopStartMsRef.current = now;

    const activeTag = tag ?? null;
    setCurrentPitStopTagState(activeTag);

    // Persist to SQLite
    await savePitStop({
      id: pitId,
      tripKey: currentTripKeyRef.current ?? '',
      lat: loc?.latitude ?? 0,
      lng: loc?.longitude ?? 0,
      startedMs: now,
      tag: activeTag,
    });

    startPitTimer(now);
  };

  // ── Resume from pit stop ────────────────────────────────────────────────────

  const resumeTracking = async (): Promise<void> => {
    if (phase !== 'pit-stopped') return;

    const endMs = Date.now();
    const startMs = pitStopStartMsRef.current ?? endMs;
    const durationS = Math.round((endMs - startMs) / 1000);

    stopPitTimer();
    await clearPitStop();

    // Record the completed pit stop
    const prevLoc = lastSampleRef.current;
    const savedStop = await loadActivePitStop(); // already cleared — get coords from ref
    const stopLat = prevLoc?.latitude ?? 0;
    const stopLng = prevLoc?.longitude ?? 0;

    pitStopIntervalsRef.current.push({ startMs, endMs });

    // Resume foreground sub first so we can get resume coord
    foregroundSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc) => {
        const accuracy = loc.coords.accuracy ?? 999;
        setGpsAccuracy(accuracy);
        if (loc.coords.heading != null && loc.coords.heading >= 0) {
          setHeading(loc.coords.heading);
        }
        const sample: GpsSample = {
          latitude:  loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed:     Math.max(0, loc.coords.speed ?? 0),
          timestamp: loc.timestamp,
          accuracy,
        };
        globalSamplesBuffer.push(sample);
        handleNewSample(sample);
      },
    );

    // Get the first fix after resume for the gap line
    const resumeCoords = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);

    const record: PitStopRecord = {
      id:          generateClientId(),
      lat:         stopLat,
      lng:         stopLng,
      started_at:  new Date(startMs).toISOString(),
      ended_at:    new Date(endMs).toISOString(),
      duration_s:  durationS,
      tag:         currentPitStopTag,
      resume_lat:  resumeCoords?.coords.latitude ?? null,
      resume_lng:  resumeCoords?.coords.longitude ?? null,
    };

    pitStopsRef.current = [...pitStopsRef.current, record];
    setPitStops([...pitStopsRef.current]);
    setCurrentPitStopTagState(null);
    setPhase('recording');
    startMovingTimer();

    // suppress unused warning
    void savedStop;
  };

  // ── Tag the active pit stop ─────────────────────────────────────────────────

  const setCurrentPitStopTag = async (tag: PitStopTag): Promise<void> => {
    setCurrentPitStopTagState(tag);
    await updatePitStopTag(tag);
  };

  // ── Stop tracking ───────────────────────────────────────────────────────────

  const stopTracking = async (): Promise<TripMetrics | null> => {
    if (!isTracking) return null;

    stopMovingTimer();
    stopPitTimer();

    foregroundSubRef.current?.remove();
    foregroundSubRef.current = null;

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      }
    } catch (err) {
      console.warn('[TrackingContext] Error stopping background task:', err);
    }

    await clearPitStop();
    setPhase('saving');

    const endTime  = Date.now();
    const startTime = startTimeRef.current ?? endTime;
    const finalSamples = [...globalSamplesBuffer];
    const allPitStops  = pitStopsRef.current;
    const intervals    = pitStopIntervalsRef.current;
    const endLoc       = lastSampleRef.current;

    const metrics = computeTripMetrics(finalSamples, startTime, endTime, intervals);

    if (user?.id) {
      try {
        const vehicleId = activeVehicleIdRef.current ?? activeVehicleId ?? primaryVehicle?.id ?? null;

        // Downsample full buffer for storage
        const filtered    = filterNoisySamples(finalSamples);
        const downsampled = douglasPeucker(filtered, 10);

        const payload = {
          client_id:        currentTripKeyRef.current ?? generateClientId(),
          user_id:          user.id,
          vehicle_id:       vehicleId,
          route:            metrics.lineStringWkt,
          route_points:     metrics.routePoints as unknown as import('@/types/database').Json,
          distance_m:       metrics.distanceMeters,
          duration_s:       metrics.durationSeconds,
          moving_time_s:    metrics.movingTimeSeconds,
          top_speed:        metrics.topSpeedKmh,
          avg_speed:        metrics.avgSpeedKmh,
          pit_stop_count:   metrics.pitStopCount,
          pit_stop_total_s: metrics.pitStopTotalSeconds,
          pit_stops:        allPitStops as unknown as import('@/types/database').Json,
          speed_samples:    downsampled.slice(-200) as unknown as import('@/types/database').Json,
          start_latlng:     startCoords
            ? { lat: startCoords[1], lng: startCoords[0] } as unknown as import('@/types/database').Json
            : null,
          end_latlng:       endLoc
            ? { lat: endLoc.latitude, lng: endLoc.longitude } as unknown as import('@/types/database').Json
            : null,
          started_at:       new Date(startTime).toISOString(),
          ended_at:         new Date(endTime).toISOString(),
          snapshot_url:     null, // updated after snapshot capture via updateTripSnapshot()
        };

        await enqueueOrExec('trip', payload, () => saveTrip(payload));
      } catch (err) {
        console.error('[TrackingContext] Exception saving trip:', err);
      }
    }

    setPhase('idle');

    metrics.startCoords = startCoords;
    metrics.endCoords = endLoc ? [endLoc.longitude, endLoc.latitude] : null;
    metrics.pitStops = allPitStops;
    metrics.clientId = currentTripKeyRef.current ?? undefined;
    metrics.vehicleId = activeVehicleIdRef.current ?? activeVehicleId ?? primaryVehicle?.id ?? null;

    return metrics;
  };

  // ── Route GeoJSON for live map ──────────────────────────────────────────────
  const routeGeoJson = samplesToGeoJsonLine(samples);

  // ── Context value ───────────────────────────────────────────────────────────

  return (
    <TrackingContext.Provider
      value={{
        phase,
        isTracking,
        isPitStopped,
        isSaving,
        isGpsWaiting,
        currentSpeedKmh,
        topSpeedKmh,
        elapsedSeconds,
        pitStopElapsedSeconds,
        distanceMeters,
        samples,
        routeGeoJson,
        currentCoords,
        gpsAccuracy,
        heading,
        startCoords,
        pitStops,
        currentPitStopTag,
        permissionGranted,
        requestPermissions,
        startTracking,
        stopTracking,
        pauseTracking,
        resumeTracking,
        setCurrentPitStopTag,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = (): TrackingContextValue => {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within a <TrackingProvider>');
  return ctx;
};
