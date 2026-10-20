/**
 * TrackingContext — Slipstream Drive Recording Engine
 *
 * Implements strict GPS accuracy, phantom speed elimination, and complete state reset:
 * - Doppler speed only (m/s) with 3-fix acquisition locking.
 * - Stationary clamp (< 2.0 m/s or low accelerometer variance forces speed & distance to 0).
 * - Single shared location subscription for map and telemetry.
 * - Fast first fix using getLastKnownPositionAsync.
 * - Android approximate vs precise permission check and location services prompt.
 * - Full state reset on hold-to-end (dashes and 00:00 on idle).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Accelerometer } from 'expo-sensors';
import { saveTrip } from '@/services/trips';
import { enqueueOrExec, generateClientId } from '@/services/offlineQueue';
import { useAuth } from '@/contexts/AuthContext';
import { useVehicleContext } from '@/contexts/VehicleContext';
import {
  SpeedPipeline,
  type GpsQuality,
  type RawGpsFix,
} from '@/utils/speedPipeline';
import type { GpsDiagnosticsData } from '@/components/tracking/GpsDiagnosticsModal';
import {
  type GpsSample,
  type PitStopRecord,
  type PitStopInterval,
  type TripMetrics,
  computeTripMetrics,
  samplesToGeoJsonLine,
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

// ─────────────────────────────────────────────────────────────────────────────
// Background task — defined once at module level
// ─────────────────────────────────────────────────────────────────────────────

let globalSamplesBuffer: GpsSample[] = [];
let onSampleListeners: ((sample: GpsSample) => void)[] = [];

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
  | 'gps-wait'   // waiting for 3 consecutive good fixes <= 25m
  | 'recording'
  | 'pit-stopped'
  | 'saving';

export interface TrackingContextValue {
  phase: TrackingPhase;
  isTracking: boolean;
  isPitStopped: boolean;
  isSaving: boolean;
  isGpsWaiting: boolean;

  currentSpeedKmh: number;
  displaySpeedString: string;
  topSpeedKmh: number;
  elapsedSeconds: number;
  pitStopElapsedSeconds: number;
  distanceMeters: number;
  samples: GpsSample[];
  routeGeoJson: FeatureCollection<LineString>;
  currentCoords: [number, number] | null;
  gpsAccuracy: number | null;
  gpsQuality: GpsQuality;
  consecutiveGoodFixes: number;
  heading: number | null;
  startCoords: [number, number] | null;
  pitStops: PitStopRecord[];
  currentPitStopTag: PitStopTag | null;

  diagnostics: GpsDiagnosticsData;
  permissionGranted: boolean;
  isApproximateLocation: boolean;
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

  const [phase, setPhase] = useState<TrackingPhase>('idle');

  // Live telemetry
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [displaySpeedString, setDisplaySpeedString] = useState('—');
  const [topSpeedKmh, setTopSpeedKmh] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pitStopElapsedSeconds, setPitStopElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsQuality, setGpsQuality] = useState<GpsQuality>('acquiring');
  const [consecutiveGoodFixes, setConsecutiveGoodFixes] = useState(0);
  const [heading, setHeading] = useState<number | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [pitStops, setPitStops] = useState<PitStopRecord[]>([]);
  const [currentPitStopTag, setCurrentPitStopTagState] = useState<PitStopTag | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isApproximateLocation, setIsApproximateLocation] = useState(false);

  // Diagnostics state
  const [diagnostics, setDiagnostics] = useState<GpsDiagnosticsData>({
    rawSpeedMs: 0,
    accuracy: null,
    fixAgeMs: null,
    provider: 'GPS / Fused',
    ttffSeconds: null,
    consecutiveGoodFixes: 0,
  });

  // Pipeline instance
  const pipelineRef = useRef<SpeedPipeline>(new SpeedPipeline());

  // Accelerometer monitoring for stationary clamping
  const accelSamplesRef = useRef<number[]>([]);
  const accelVarianceRef = useRef<number>(0.05);

  // Timing refs
  const mountTimeRef = useRef<number>(Date.now());
  const ttffSecondsRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const movingStartRef = useRef<number | null>(null);
  const activeVehicleIdRef = useRef<string | null>(null);
  const currentTripKeyRef = useRef<string | null>(null);
  const pitStopsRef = useRef<PitStopRecord[]>([]);
  const pitStopIntervalsRef = useRef<PitStopInterval[]>([]);
  const pitStopStartMsRef = useRef<number | null>(null);
  const accumulatedMovingMs = useRef(0);
  const lastSampleRef = useRef<GpsSample | null>(null);

  // Single shared location watcher
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const movingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTracking = phase === 'recording' || phase === 'pit-stopped';
  const isPitStopped = phase === 'pit-stopped';
  const isSaving = phase === 'saving';
  const isGpsWaiting = phase === 'gps-wait';

  // ── Accelerometer Listener for Stationary Verification ──────────────────────
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    try {
      Accelerometer.setUpdateInterval(250);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        accelSamplesRef.current.push(mag);
        if (accelSamplesRef.current.length > 12) {
          accelSamplesRef.current.shift();
        }
        if (accelSamplesRef.current.length >= 6) {
          const mean = accelSamplesRef.current.reduce((a, b) => a + b, 0) / accelSamplesRef.current.length;
          const variance =
            accelSamplesRef.current.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
            accelSamplesRef.current.length;
          accelVarianceRef.current = variance;
        }
      });
    } catch {
      // Sensibly ignore if accelerometer not supported
    }
    return () => {
      sub?.remove();
    };
  }, []);

  // ── Process incoming fix through SpeedPipeline ─────────────────────────────
  const handleIncomingLocation = useCallback((loc: Location.LocationObject) => {
    const now = Date.now();
    const rawFix: RawGpsFix = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      speed: loc.coords.speed,
      accuracy: loc.coords.accuracy ?? null,
      timestamp: loc.timestamp,
      heading: loc.coords.heading,
    };

    // Calculate TTFF if not yet recorded and fix accuracy is good
    if (ttffSecondsRef.current === null && rawFix.accuracy !== null && rawFix.accuracy <= 25) {
      const ttff = (now - mountTimeRef.current) / 1000;
      ttffSecondsRef.current = ttff;
      console.log(`[TrackingContext] Time to First Fix (TTFF): ${ttff.toFixed(2)}s, accuracy: ${rawFix.accuracy}m`);
    }

    // Process through mathematical pipeline with accelerometer variance
    const output = pipelineRef.current.processFix(rawFix, accelVarianceRef.current);

    // Update coordinates & heading
    setCurrentCoords([rawFix.longitude, rawFix.latitude]);
    if (rawFix.heading !== null && rawFix.heading !== undefined && rawFix.heading >= 0) {
      setHeading(rawFix.heading);
    }

    setGpsAccuracy(output.accuracy);
    setGpsQuality(output.quality);
    setConsecutiveGoodFixes(output.consecutiveGoodFixes);

    // Speed display
    if (output.displaySpeedKmh === null) {
      setDisplaySpeedString('—');
      setCurrentSpeedKmh(0);
    } else {
      setDisplaySpeedString(String(output.displaySpeedKmh));
      setCurrentSpeedKmh(output.displaySpeedKmh);
    }

    // Update diagnostics
    setDiagnostics({
      rawSpeedMs: Math.max(0, loc.coords.speed ?? 0),
      accuracy: output.accuracy,
      fixAgeMs: now - loc.timestamp,
      provider: loc.mocked ? 'Mock GPS' : 'GPS / Fused',
      ttffSeconds: ttffSecondsRef.current,
      consecutiveGoodFixes: output.consecutiveGoodFixes,
    });

    const sample: GpsSample = {
      latitude: rawFix.latitude,
      longitude: rawFix.longitude,
      speed: output.filteredSpeedMs,
      timestamp: rawFix.timestamp,
      accuracy: rawFix.accuracy ?? undefined,
    };
    lastSampleRef.current = sample;

    // Check GPS wait lock during start
    if (phase === 'gps-wait' && output.consecutiveGoodFixes >= 3) {
      setStartCoords([rawFix.longitude, rawFix.latitude]);
      setPhase('recording');
      startTimeRef.current = now;
      startMovingTimer();
    }

    // If currently recording: accumulate distance and record samples
    if (phase === 'recording') {
      if (output.displaySpeedKmh !== null && output.displaySpeedKmh > 0) {
        setTopSpeedKmh(output.topSpeedKmh);
      }
      setDistanceMeters(output.totalDistanceMeters);
      setSamples((prev) => [...prev, sample]);
      globalSamplesBuffer.push(sample);
    }
  }, [phase]);

  // ── Permission & Accuracy Check ────────────────────────────────────────────
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      // Check location services enabled
      const servicesOn = await Location.hasServicesEnabledAsync().catch(() => true);
      if (!servicesOn) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable Location Services / GPS on your device to track your speed and drives with high precision.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Settings',
              onPress: () => {
                Location.enableNetworkProviderAsync().catch(() => {});
              },
            },
          ],
        );
      }

      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setPermissionGranted(false);
        return false;
      }

      // Check for Android Approximate (coarse) permission
      if (Platform.OS === 'android') {
        const fgDetails = await Location.getForegroundPermissionsAsync();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const androidAccuracy = (fgDetails as any)?.android?.accuracy;
        if (androidAccuracy === 'coarse') {
          setIsApproximateLocation(true);
          Alert.alert(
            'Precise Location Required',
            'Slipstream requires Precise Location permission for high-accuracy telemetry, lap timing, and speedometer readings. Please set Location accuracy to "Precise" in App Settings.',
          );
        } else {
          setIsApproximateLocation(false);
        }
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
      setPermissionGranted(true);

      // Fast initial fix from getLastKnownPositionAsync
      const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
      if (lastKnown && lastKnown.coords) {
        setCurrentCoords([lastKnown.coords.longitude, lastKnown.coords.latitude]);
        setGpsAccuracy(lastKnown.coords.accuracy ?? null);
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

  // ── ONE Shared Location Subscription ───────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    if (!permissionGranted) return;

    // Start single high-accuracy subscription
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      },
      (loc) => {
        if (!mounted) return;
        handleIncomingLocation(loc);
      },
    )
      .then((sub) => {
        if (!mounted) sub.remove();
        else locationSubRef.current = sub;
      })
      .catch((err) => {
        console.warn('[TrackingContext] Watch position error:', err);
      });

    return () => {
      mounted = false;
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, [permissionGranted, handleIncomingLocation]);

  // Restore pit stop if app was killed mid-pause
  useEffect(() => {
    loadActivePitStop().then((saved) => {
      if (saved && currentTripKeyRef.current === saved.tripKey) {
        pitStopStartMsRef.current = saved.startedMs;
        setCurrentPitStopTagState(saved.tag);
        setPhase('pit-stopped');
        startPitTimer(saved.startedMs);
      }
    });
  }, []);

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

    // Reset pipeline & metrics
    pipelineRef.current.reset();
    globalSamplesBuffer = [];
    setSamples([]);
    setCurrentSpeedKmh(0);
    setDisplaySpeedString('—');
    setTopSpeedKmh(0);
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setStartCoords(null);
    setPitStops([]);
    pitStopsRef.current = [];
    pitStopIntervalsRef.current = [];
    accumulatedMovingMs.current = 0;

    const tripKey = generateClientId();
    currentTripKeyRef.current = tripKey;
    activeVehicleIdRef.current = activeVehicleId ?? primaryVehicle?.id ?? null;
    const now = Date.now();
    startTimeRef.current = now;

    // Check if we already have 3 consecutive good fixes
    if (consecutiveGoodFixes >= 3 && currentCoords) {
      setStartCoords([currentCoords[0], currentCoords[1]]);
      setPhase('recording');
      startMovingTimer();
    } else {
      setPhase('gps-wait');
    }

    // Start background task
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

    const pitId = generateClientId();
    pitStopStartMsRef.current = now;
    const activeTag = tag ?? null;
    setCurrentPitStopTagState(activeTag);

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

    const prevLoc = lastSampleRef.current;
    const stopLat = prevLoc?.latitude ?? 0;
    const stopLng = prevLoc?.longitude ?? 0;

    pitStopIntervalsRef.current.push({ startMs, endMs });

    const resumeCoords = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    }).catch(() => null);

    const record: PitStopRecord = {
      id: generateClientId(),
      lat: stopLat,
      lng: stopLng,
      started_at: new Date(startMs).toISOString(),
      ended_at: new Date(endMs).toISOString(),
      duration_s: durationS,
      tag: currentPitStopTag,
      resume_lat: resumeCoords?.coords.latitude ?? null,
      resume_lng: resumeCoords?.coords.longitude ?? null,
    };

    pitStopsRef.current = [...pitStopsRef.current, record];
    setPitStops([...pitStopsRef.current]);
    setCurrentPitStopTagState(null);
    setPhase('recording');
    startMovingTimer();
  };

  const setCurrentPitStopTag = async (tag: PitStopTag): Promise<void> => {
    setCurrentPitStopTagState(tag);
    await updatePitStopTag(tag);
  };

  // ── Stop tracking (Hold-to-End) ─────────────────────────────────────────────
  const stopTracking = async (): Promise<TripMetrics | null> => {
    if (!isTracking) return null;

    stopMovingTimer();
    stopPitTimer();

    // Stop background task
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

    const endTime = Date.now();
    const startTime = startTimeRef.current ?? endTime;
    const finalSamples = [...globalSamplesBuffer];
    const allPitStops = pitStopsRef.current;
    const intervals = pitStopIntervalsRef.current;
    const endLoc = lastSampleRef.current;

    const metrics = computeTripMetrics(finalSamples, startTime, endTime, intervals);

    if (user?.id) {
      try {
        const vehicleId = activeVehicleIdRef.current ?? activeVehicleId ?? primaryVehicle?.id ?? null;
        const filtered = filterNoisySamples(finalSamples);
        const downsampled = douglasPeucker(filtered, 10);

        const payload = {
          client_id: currentTripKeyRef.current ?? generateClientId(),
          user_id: user.id,
          vehicle_id: vehicleId,
          route: metrics.lineStringWkt,
          route_points: metrics.routePoints as unknown as import('@/types/database').Json,
          distance_m: metrics.distanceMeters,
          duration_s: metrics.durationSeconds,
          moving_time_s: metrics.movingTimeSeconds,
          top_speed: metrics.topSpeedKmh,
          avg_speed: metrics.avgSpeedKmh,
          pit_stop_count: metrics.pitStopCount,
          pit_stop_total_s: metrics.pitStopTotalSeconds,
          pit_stops: allPitStops as unknown as import('@/types/database').Json,
          speed_samples: downsampled.slice(-200) as unknown as import('@/types/database').Json,
          start_latlng: startCoords
            ? ({ lat: startCoords[1], lng: startCoords[0] } as unknown as import('@/types/database').Json)
            : null,
          end_latlng: endLoc
            ? ({ lat: endLoc.latitude, lng: endLoc.longitude } as unknown as import('@/types/database').Json)
            : null,
          started_at: new Date(startTime).toISOString(),
          ended_at: new Date(endTime).toISOString(),
          snapshot_url: null,
        };

        await enqueueOrExec('trip', payload, () => saveTrip(payload));
      } catch (err) {
        console.error('[TrackingContext] Exception saving trip:', err);
      }
    }

    metrics.startCoords = startCoords;
    metrics.endCoords = endLoc ? [endLoc.longitude, endLoc.latitude] : null;
    metrics.pitStops = allPitStops;
    metrics.clientId = currentTripKeyRef.current ?? undefined;
    metrics.vehicleId = activeVehicleIdRef.current ?? activeVehicleId ?? primaryVehicle?.id ?? null;

    // ── COMPLETE STATE RESET ON STOP (Requirement C) ──
    pipelineRef.current.reset();
    setCurrentSpeedKmh(0);
    setDisplaySpeedString('—');
    setTopSpeedKmh(0);
    setElapsedSeconds(0);
    setPitStopElapsedSeconds(0);
    setDistanceMeters(0);
    setSamples([]);
    globalSamplesBuffer = [];
    setStartCoords(null);
    setPitStops([]);
    pitStopsRef.current = [];
    pitStopIntervalsRef.current = [];
    accumulatedMovingMs.current = 0;
    setPhase('idle');

    return metrics;
  };

  // Route GeoJSON: empty when idle / not recording
  const routeGeoJson: FeatureCollection<LineString> = isTracking
    ? samplesToGeoJsonLine(samples)
    : { type: 'FeatureCollection', features: [] };

  return (
    <TrackingContext.Provider
      value={{
        phase,
        isTracking,
        isPitStopped,
        isSaving,
        isGpsWaiting,
        currentSpeedKmh,
        displaySpeedString,
        topSpeedKmh,
        elapsedSeconds,
        pitStopElapsedSeconds,
        distanceMeters,
        samples,
        routeGeoJson,
        currentCoords,
        gpsAccuracy,
        gpsQuality,
        consecutiveGoodFixes,
        heading,
        startCoords: isTracking ? startCoords : null,
        pitStops: isTracking ? pitStops : [],
        currentPitStopTag,
        diagnostics,
        permissionGranted,
        isApproximateLocation,
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
