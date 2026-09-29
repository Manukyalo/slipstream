import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';

import { useAuth } from '@/contexts/AuthContext';
import { useVehicles } from '@/hooks/useVehicles';
import {
  saveDragRun,
  saveSprintRun,
  DRAG_DISTANCE_METERS,
  SPRINT_TARGET_SPEED_KMH,
  type DragDistanceType,
  type SprintType,
} from '@/services/dragRuns';
import { calculateDistanceMeters } from '@/utils/telemetry';

export type DragRaceStatus = 'idle' | 'staging' | 'staged' | 'running' | 'finished';
export type RaceTargetMode = 'all' | 'drag' | 'sprint_60' | 'sprint_100';

export interface SplitResult {
  distanceType: DragDistanceType;
  distanceMeters: number;
  elapsedMs: number;
  trapSpeedKmh: number;
  saved: boolean;
}

export interface SprintResult {
  sprintType: SprintType;
  targetSpeedKmh: number;
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
  sprints: Record<SprintType, SprintResult | null>;
  mode: RaceTargetMode;
  setMode: (mode: RaceTargetMode) => void;
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
  const [mode, setMode] = useState<RaceTargetMode>('all');
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

  const [sprints, setSprints] = useState<Record<SprintType, SprintResult | null>>({
    zero_to_60: null,
    zero_to_100: null,
  });

  // Internal tracking refs
  const statusRef = useRef<DragRaceStatus>('idle');
  statusRef.current = status;

  const modeRef = useRef<RaceTargetMode>('all');
  modeRef.current = mode;

  const baselineGRef = useRef<number>(1.0);
  const accelSamplesRef = useRef<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocationRef = useRef<Location.LocationObjectCoords | null>(null);
  const cumulativeDistanceRef = useRef<number>(0);
  const topSpeedRef = useRef<number>(0);
  const prevSpeedRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const splitsRecordedRef = useRef<Set<DragDistanceType>>(new Set());
  const sprintsRecordedRef = useRef<Set<SprintType>>(new Set());

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
    prevSpeedRef.current = 0;
    prevTimeRef.current = now;
    splitsRecordedRef.current.clear();
    sprintsRecordedRef.current.clear();

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

              // Check split thresholds (distance)
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

                  // If full mile reached (or drag mode 1/4 mile reached), mark finished
                  const currentMode = modeRef.current;
                  if (
                    (currentMode === 'drag' && type === 'quarter_mile') ||
                    (currentMode === 'all' && type === 'one_mile')
                  ) {
                    setStatus('finished');
                    statusRef.current = 'finished';
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  }
                }
              };

              checkSplit('quarter_mile', DRAG_DISTANCE_METERS.quarter_mile);
              checkSplit('half_mile', DRAG_DISTANCE_METERS.half_mile);
              checkSplit('one_mile', DRAG_DISTANCE_METERS.one_mile);

              // Check sprint thresholds (speed) with sub-tick interpolation
              const checkSprint = (type: SprintType, targetSpeed: number) => {
                if (
                  speedKmh >= targetSpeed &&
                  !sprintsRecordedRef.current.has(type)
                ) {
                  sprintsRecordedRef.current.add(type);

                  const vCurr = speedKmh;
                  const vPrev = prevSpeedRef.current;
                  const tCurr = now;
                  const tPrev = prevTimeRef.current;
                  const tStart = startTimeRef.current ?? now;

                  let sprintElapsed = elapsed;
                  if (vCurr > vPrev && vPrev < targetSpeed && tPrev > tStart) {
                    const fraction = (targetSpeed - vPrev) / (vCurr - vPrev);
                    const interpolatedTime = tPrev + fraction * (tCurr - tPrev);
                    sprintElapsed = Math.max(0, Math.round(interpolatedTime - tStart));
                  }

                  const sprintResult: SprintResult = {
                    sprintType: type,
                    targetSpeedKmh: targetSpeed,
                    elapsedMs: sprintElapsed,
                    trapSpeedKmh: vCurr,
                    saved: false,
                  };

                  setSprints((prev) => ({ ...prev, [type]: sprintResult }));

                  if (user) {
                    saveSprintRun({
                      userId: user.id,
                      vehicleId: primaryVehicle?.id ?? null,
                      sprintType: type,
                      elapsedMs: sprintElapsed,
                      topSpeed: vCurr,
                    })
                      .then(() => {
                        setSprints((prev) => ({
                          ...prev,
                          [type]: { ...sprintResult, saved: true },
                        }));
                      })
                      .catch((err) => {
                        console.error(`[useDragRace] Failed to save sprint ${type}:`, err);
                      });
                  }

                  const currentMode = modeRef.current;
                  if (
                    (currentMode === 'sprint_60' && type === 'zero_to_60') ||
                    (currentMode === 'sprint_100' && type === 'zero_to_100')
                  ) {
                    setStatus('finished');
                    statusRef.current = 'finished';
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  }
                }
              };

              checkSprint('zero_to_60', SPRINT_TARGET_SPEED_KMH.zero_to_60);
              checkSprint('zero_to_100', SPRINT_TARGET_SPEED_KMH.zero_to_100);

              prevSpeedRef.current = speedKmh;
              prevTimeRef.current = now;
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
    prevSpeedRef.current = 0;
    setElapsedMs(0);
    setDistanceTraveledMeters(0);
    setTopSpeedKmh(0);
    setSplits({
      quarter_mile: null,
      half_mile: null,
      one_mile: null,
    });
    setSprints({
      zero_to_60: null,
      zero_to_100: null,
    });
    sprintsRecordedRef.current.clear();
    splitsRecordedRef.current.clear();
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
    prevSpeedRef.current = 0;
    setSplits({
      quarter_mile: null,
      half_mile: null,
      one_mile: null,
    });
    setSprints({
      zero_to_60: null,
      zero_to_100: null,
    });
    sprintsRecordedRef.current.clear();
    splitsRecordedRef.current.clear();
  }, []);

  return {
    status,
    elapsedMs,
    currentSpeedKmh,
    distanceTraveledMeters,
    topSpeedKmh,
    splits,
    sprints,
    mode,
    setMode,
    gForceMagnitude,
    stageVehicle,
    abortRun,
    resetTimer,
    manualLaunch: handleLaunch,
  };
}
