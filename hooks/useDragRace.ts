import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';

import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import {
  saveDragRun,
  DRAG_DISTANCE_METERS,
  type DragDistanceType,
} from '@/services/dragRuns';
import { calculateDistanceMeters } from '@/utils/telemetry';

export type DragRaceStatus = 'idle' | 'staging' | 'staged' | 'running' | 'finished';

export interface SplitResult {
  distanceType: DragDistanceType;
  distanceMeters: number;
  elapsedMs: number;
  trapSpeedKmh: number;
  saved: boolean;
}

export interface UseDragRaceResult {
  status: DragRaceStatus;
  elapsedMs: number;
  currentSpeedKmh: number;
  distanceTraveledMeters: number;
  topSpeedKmh: number;
  splits: Record<DragDistanceType, SplitResult | null>;
  gForceMagnitude: number;
  stageVehicle: () => Promise<void>;
  abortRun: () => void;
  resetTimer: () => void;
  manualLaunch: () => void;
}

const ACCEL_THRESHOLD_DELTA_G = 0.35; // G-force increase over baseline to trigger launch

export function useDragRace(): UseDragRaceResult {
  const { user } = useAuth();
  const { primaryVehicle } = useVehicles();

  const [status, setStatus] = useState<DragRaceStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [distanceTraveledMeters, setDistanceTraveledMeters] = useState<number>(0);
  const [topSpeedKmh, setTopSpeedKmh] = useState<number>(0);
  const [gForceMagnitude, setGForceMagnitude] = useState<number>(1.0);

  const [splits, setSplits] = useState<Record<DragDistanceType, SplitResult | null>>({
    quarter_mile: null,
    half_mile: null,
    one_mile: null,
  });

  // Internal tracking refs
  const statusRef = useRef<DragRaceStatus>('idle');
  statusRef.current = status;

  const baselineGRef = useRef<number>(1.0);
  const accelSamplesRef = useRef<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocationRef = useRef<Location.LocationObjectCoords | null>(null);
  const cumulativeDistanceRef = useRef<number>(0);
  const topSpeedRef = useRef<number>(0);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const splitsRecordedRef = useRef<Set<DragDistanceType>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (locationSubRef.current) locationSubRef.current.remove();
    };
  }, []);

  const handleLaunch = useCallback(() => {
    if (statusRef.current !== 'staged') return;

    setStatus('running');
    statusRef.current = 'running';
    const now = Date.now();
    startTimeRef.current = now;
    cumulativeDistanceRef.current = 0;
    topSpeedRef.current = 0;
    splitsRecordedRef.current.clear();

    // High resolution display timer
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 16); // ~60fps timer display
  }, []);

  // Accelerometer subscription for auto-launch detection
  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    Accelerometer.setUpdateInterval(40); // 25Hz sensor updates

    sub = Accelerometer.addListener((data) => {
      const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
      setGForceMagnitude(mag);

      if (statusRef.current === 'staging') {
        // Collect samples to determine baseline stationary gravity
        accelSamplesRef.current.push(mag);
        if (accelSamplesRef.current.length > 20) {
          const avg =
            accelSamplesRef.current.reduce((a, b) => a + b, 0) /
            accelSamplesRef.current.length;
          baselineGRef.current = avg;
          accelSamplesRef.current = [];
          setStatus('staged');
          statusRef.current = 'staged';
        }
      } else if (statusRef.current === 'staged') {
        const delta = Math.abs(mag - baselineGRef.current);
        if (delta >= ACCEL_THRESHOLD_DELTA_G) {
          handleLaunch();
        }
      }
    });

    return () => {
      if (sub) sub.remove();
    };
  }, [handleLaunch]);

  // High-frequency GPS updates for elapsed distance & trap speeds
  useEffect(() => {
    let active = true;

    async function startLocationWatch() {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted' || !active) return;

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 200,
          distanceInterval: 0.5,
        },
        (loc) => {
          if (!active) return;

          const speedKmh = Math.max(0, (loc.coords.speed ?? 0) * 3.6);
          setCurrentSpeedKmh(speedKmh);

          if (speedKmh > topSpeedRef.current) {
            topSpeedRef.current = speedKmh;
            setTopSpeedKmh(speedKmh);
          }

          // If car launches via GPS movement while staged
          if (statusRef.current === 'staged' && speedKmh > 5.0) {
            handleLaunch();
          }

          if (statusRef.current === 'running') {
            if (lastLocationRef.current) {
              const d = calculateDistanceMeters(
                lastLocationRef.current.latitude,
                lastLocationRef.current.longitude,
                loc.coords.latitude,
                loc.coords.longitude,
              );
              cumulativeDistanceRef.current += d;
              setDistanceTraveledMeters(cumulativeDistanceRef.current);

              const currentDist = cumulativeDistanceRef.current;
              const now = Date.now();
              const elapsed = startTimeRef.current ? now - startTimeRef.current : 0;

              // Check split thresholds
              const checkSplit = (
                type: DragDistanceType,
                thresholdMeters: number,
              ) => {
                if (
                  currentDist >= thresholdMeters &&
                  !splitsRecordedRef.current.has(type)
                ) {
                  splitsRecordedRef.current.add(type);
                  const splitResult: SplitResult = {
                    distanceType: type,
                    distanceMeters: thresholdMeters,
                    elapsedMs: elapsed,
                    trapSpeedKmh: speedKmh,
                    saved: false,
                  };

                  setSplits((prev) => ({ ...prev, [type]: splitResult }));

                  // Save to Supabase
                  if (user) {
                    saveDragRun({
                      userId: user.id,
                      vehicleId: primaryVehicle?.id ?? null,
                      distanceType: type,
                      elapsedMs: elapsed,
                      topSpeed: speedKmh,
                    })
                      .then(() => {
                        setSplits((prev) => ({
                          ...prev,
                          [type]: { ...splitResult, saved: true },
                        }));
                      })
                      .catch((saveErr) => {
                        console.error(`[useDragRace] Failed to save ${type} run:`, saveErr);
                      });
                  }

                  // If full mile reached, mark finished
                  if (type === 'one_mile') {
                    setStatus('finished');
                    statusRef.current = 'finished';
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  }
                }
              };

              checkSplit('quarter_mile', DRAG_DISTANCE_METERS.quarter_mile);
              checkSplit('half_mile', DRAG_DISTANCE_METERS.half_mile);
              checkSplit('one_mile', DRAG_DISTANCE_METERS.one_mile);
            }
            lastLocationRef.current = loc.coords;
          } else {
            lastLocationRef.current = loc.coords;
          }
        },
      );
    }

    startLocationWatch();

    return () => {
      active = false;
      if (locationSubRef.current) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
      }
    };
  }, [handleLaunch, user, primaryVehicle]);

  const stageVehicle = useCallback(async () => {
    accelSamplesRef.current = [];
    cumulativeDistanceRef.current = 0;
    topSpeedRef.current = 0;
    setElapsedMs(0);
    setDistanceTraveledMeters(0);
    setTopSpeedKmh(0);
    setSplits({
      quarter_mile: null,
      half_mile: null,
      one_mile: null,
    });
    setStatus('staging');
    statusRef.current = 'staging';
  }, []);

  const abortRun = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setStatus('idle');
    statusRef.current = 'idle';
  }, []);

  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setStatus('idle');
    statusRef.current = 'idle';
    setElapsedMs(0);
    setDistanceTraveledMeters(0);
    setTopSpeedKmh(0);
    setSplits({
      quarter_mile: null,
      half_mile: null,
      one_mile: null,
    });
  }, []);

  return {
    status,
    elapsedMs,
    currentSpeedKmh,
    distanceTraveledMeters,
    topSpeedKmh,
    splits,
    gForceMagnitude,
    stageVehicle,
    abortRun,
    resetTimer,
    manualLaunch: handleLaunch,
  };
}
