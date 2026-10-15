import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { saveTrip } from '@/services/trips';
import { enqueueOrExec, generateClientId } from '@/services/offlineQueue';
import { fetchUserVehicles } from '@/services/vehicles';
import { useAuth } from '@/contexts/AuthContext';
import {
  GpsSample,
  TripMetrics,
  computeTripMetrics,
  msToKmh,
  samplesToGeoJsonLine,
} from '@/utils/telemetry';
import type { FeatureCollection, LineString } from 'geojson';

export const LOCATION_TRACKING_TASK = 'SLIPSTREAM_BACKGROUND_LOCATION_TASK';

// Global samples buffer used across background/foreground callbacks
let globalSamplesBuffer: GpsSample[] = [];
let onSampleListeners: ((sample: GpsSample) => void)[] = [];

// Register background TaskManager task
if (!TaskManager.isTaskDefined(LOCATION_TRACKING_TASK)) {
  TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('[TrackingTask] Error in background location task:', error);
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };
      if (locations && locations.length > 0) {
        for (const loc of locations) {
          const sample: GpsSample = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            speed: Math.max(0, loc.coords.speed ?? 0),
            timestamp: loc.timestamp,
          };
          globalSamplesBuffer.push(sample);
          onSampleListeners.forEach((listener) => listener(sample));
        }
      }
    }
  });
}

interface TrackingContextValue {
  isTracking: boolean;
  currentSpeedKmh: number;
  topSpeedKmh: number;
  elapsedSeconds: number;
  distanceMeters: number;
  samples: GpsSample[];
  routeGeoJson: FeatureCollection<LineString>;
  currentCoords: [number, number] | null;
  gpsAccuracy: number | null;
  heading: number | null;
  isSaving: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<TripMetrics | null>;
  permissionGranted: boolean;
  requestPermissions: () => Promise<boolean>;
}

const TrackingContext = createContext<TrackingContextValue | null>(null);

export const TrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [topSpeedKmh, setTopSpeedKmh] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [currentCoords, setCurrentCoords] = useState<[number, number] | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const foregroundSubRef = useRef<Location.LocationSubscription | null>(null);
  const idleSubRef = useRef<Location.LocationSubscription | null>(null);

  // Check initial permissions and initial location fix
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') {
        setPermissionGranted(false);
        return false;
      }

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      const granted = fgStatus === 'granted';
      setPermissionGranted(granted);

      // Get initial position for map camera & initial accuracy
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

  // Idle position subscription when permission is granted and not recording
  useEffect(() => {
    let isMounted = true;
    if (permissionGranted && !isTracking) {
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1500,
          distanceInterval: 2,
        },
        (loc) => {
          if (!isMounted) return;
          setCurrentCoords([loc.coords.longitude, loc.coords.latitude]);
          setGpsAccuracy(loc.coords.accuracy ?? null);
          if (loc.coords.heading != null && loc.coords.heading >= 0) {
            setHeading(loc.coords.heading);
          }
        },
      ).then((sub) => {
        if (!isMounted) {
          sub.remove();
        } else {
          idleSubRef.current = sub;
        }
      }).catch((e) => console.warn('[TrackingContext] Idle watch error:', e));
    }

    return () => {
      isMounted = false;
      if (idleSubRef.current) {
        idleSubRef.current.remove();
        idleSubRef.current = null;
      }
    };
  }, [permissionGranted, isTracking]);

  // Handle incoming live GPS sample
  const handleNewSample = useCallback((sample: GpsSample) => {
    const kmh = msToKmh(sample.speed);
    setCurrentSpeedKmh(kmh);
    setCurrentCoords([sample.longitude, sample.latitude]);

    setTopSpeedKmh((prev) => Math.max(prev, kmh));
    setSamples((prev) => {
      const next = [...prev, sample];
      return next;
    });
  }, []);

  // Subscribe to global background listener
  useEffect(() => {
    onSampleListeners.push(handleNewSample);
    return () => {
      onSampleListeners = onSampleListeners.filter((l) => l !== handleNewSample);
    };
  }, [handleNewSample]);

  // Start trip tracking
  const startTracking = async () => {
    if (isTracking) return;

    if (idleSubRef.current) {
      idleSubRef.current.remove();
      idleSubRef.current = null;
    }

    globalSamplesBuffer = [];
    setSamples([]);
    setCurrentSpeedKmh(0);
    setTopSpeedKmh(0);
    setDistanceMeters(0);
    setElapsedSeconds(0);

    const now = Date.now();
    startTimeRef.current = now;
    setIsTracking(true);

    // Timer loop for duration counter
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    // High accuracy foreground subscription for smooth speedometer updates
    foregroundSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (loc) => {
        setGpsAccuracy(loc.coords.accuracy ?? null);
        if (loc.coords.heading != null && loc.coords.heading >= 0) {
          setHeading(loc.coords.heading);
        }
        const sample: GpsSample = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: Math.max(0, loc.coords.speed ?? 0),
          timestamp: loc.timestamp,
        };
        globalSamplesBuffer.push(sample);
        handleNewSample(sample);
      }
    );

    // Also initiate background task for uninterrupted tracking while phone screen turns off
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
      if (!isRegistered) {
        await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1500,
          distanceInterval: 2,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Slipstream Active',
            notificationBody: 'Recording trip route & telemetry',
            notificationColor: '#00D4FF',
          },
        });
      }
    } catch (err) {
      console.warn('[TrackingContext] Failed to start background tracking:', err);
    }
  };

  // Stop trip tracking and batch-insert into Supabase
  const stopTracking = async (): Promise<TripMetrics | null> => {
    if (!isTracking) return null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (foregroundSubRef.current) {
      foregroundSubRef.current.remove();
      foregroundSubRef.current = null;
    }

    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING_TASK);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      }
    } catch (err) {
      console.warn('[TrackingContext] Error stopping background task:', err);
    }

    setIsTracking(false);
    setIsSaving(true);
    const endTime = Date.now();
    const startTime = startTimeRef.current ?? endTime;
    const finalSamples = [...globalSamplesBuffer];

    // Compute client-side trip summary metrics
    const metrics = computeTripMetrics(finalSamples, startTime, endTime);

    // Single batched insert into Supabase trips table
    if (user?.id) {
      try {
        let vehicleId: string | null = null;
        try {
          const userVehicles = await fetchUserVehicles(user.id);
          const primaryVehicle = userVehicles.find((v) => v.is_primary) ?? userVehicles[0];
          if (primaryVehicle) {
            vehicleId = primaryVehicle.id;
          }
        } catch (vehErr) {
          console.warn('[TrackingContext] Could not fetch primary vehicle:', vehErr);
        }

        const payload = {
          client_id: generateClientId(),
          user_id: user.id,
          vehicle_id: vehicleId,
          route: metrics.lineStringWkt,
          distance_m: metrics.distanceMeters,
          duration_s: metrics.durationSeconds,
          top_speed: metrics.topSpeedKmh,
          avg_speed: metrics.avgSpeedKmh,
          speed_samples: finalSamples.slice(-200) as unknown as import('@/types/database').Json,
          started_at: new Date(startTime).toISOString(),
          ended_at: new Date(endTime).toISOString(),
        };

        await enqueueOrExec('trip', payload, () => saveTrip(payload));
      } catch (insertErr) {
        console.error('[TrackingContext] Exception saving trip:', insertErr);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsSaving(false);
    }

    return metrics;
  };

  const routeGeoJson = samplesToGeoJsonLine(samples);

  return (
    <TrackingContext.Provider
      value={{
        isTracking,
        currentSpeedKmh,
        topSpeedKmh,
        elapsedSeconds,
        distanceMeters,
        samples,
        routeGeoJson,
        currentCoords,
        gpsAccuracy,
        heading,
        isSaving,
        startTracking,
        stopTracking,
        permissionGranted,
        requestPermissions,
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
};

export const useTracking = (): TrackingContextValue => {
  const ctx = useContext(TrackingContext);
  if (!ctx) {
    throw new Error('useTracking must be used within a <TrackingProvider>');
  }
  return ctx;
};
