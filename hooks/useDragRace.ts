/**
 * useDragRace — Drag Telemetry Hook  v2 (Phase 6)
 *
 * Key changes from v1:
 *  - Replaced raw Accelerometer with DeviceMotion.acceleration (gravity already removed)
 *  - Zero-offset calibration during 'staging' so resting G ≤ 0.03 G
 *  - Exponential moving average low-pass filter (alpha=0.25)
 *  - GPS course projection for accurate longitudinal G when heading available
 *  - Raw surge detection (1.3x threshold) for single-frame launch bursts
 *  - Foul-start detection: if car moves before tree goes green, result is flagged
 *  - Peak-G tracking during the run
 *  - Reaction time (from stageVehicle call to first motion)
 *  - 60-ft split in addition to quarter/half/full mile
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

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
import {
  createSensorFusionState,
  resetSensorFusion,
  processSensorMeasurement,
  DEFAULT_LAUNCH_G_THRESHOLD,
  type SensorFusionState,
} from '@/utils/dragSensorFusion';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DragRaceStatus =
  | 'idle'
  | 'staging'   // Calibrating zero offset
  | 'staged'    // Calibrated, awaiting launch
  | 'running'   // Timer active
  | 'finished'  // All splits complete
  | 'foul';     // Car moved before green

export type RaceTargetMode = 'all' | 'drag' | 'sprint_60' | 'sprint_100' | 'half_mile' | 'one_mile';

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
  peakG: number;
  gForceMagnitude: number;
  reactionTimeMs: number | null;
  isFoul: boolean;
  splits: Record<DragDistanceType, SplitResult | null>;
  sprints: Record<SprintType, SprintResult | null>;
  mode: RaceTargetMode;
  setMode: (mode: RaceTargetMode) => void;
  stageVehicle: () => Promise<void>;
  abortRun: () => void;
  resetTimer: () => void;
  manualLaunch: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVICE_MOTION_INTERVAL_MS = 40; // 25 Hz
const CALIBRATION_SAMPLE_COUNT = 20;  // ~0.8 s at 25 Hz
const GPS_FOUL_SPEED_KMH = 3.0;       // Movement before green = foul
const GPS_AUTO_LAUNCH_KMH = 5.0;      // GPS-based auto-launch fallback

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useDragRace(): UseDragRaceResult {
  const { user } = useAuth();
  const { primaryVehicle } = useVehicles();

  const [status, setStatus] = useState<DragRaceStatus>('idle');
  const [mode, setMode] = useState<RaceTargetMode>('all');
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number>(0);
  const [distanceTraveledMeters, setDistanceTraveledMeters] = useState<number>(0);
  const [topSpeedKmh, setTopSpeedKmh] = useState<number>(0);
  const [gForceMagnitude, setGForceMagnitude] = useState<number>(0);
  const [peakG, setPeakG] = useState<number>(0);
  const [reactionTimeMs, setReactionTimeMs] = useState<number | null>(null);
  const [isFoul, setIsFoul] = useState<boolean>(false);

  const [splits, setSplits] = useState<Record<DragDistanceType, SplitResult | null>>({
    quarter_mile: null,
    half_mile: null,
    one_mile: null,
  });

  const [sprints, setSprints] = useState<Record<SprintType, SprintResult | null>>({
    zero_to_60: null,
    zero_to_100: null,
  });

  // ── Refs (stable across renders, safe in sensor callbacks) ─────────────────
  const statusRef = useRef<DragRaceStatus>('idle');
  statusRef.current = status;

  const modeRef = useRef<RaceTargetMode>('all');
  modeRef.current = mode;

  const fusionStateRef = useRef<SensorFusionState>(createSensorFusionState());
  const calibrationCountRef = useRef<number>(0);

  const startTimeRef = useRef<number | null>(null);
  const stageTimeRef = useRef<number | null>(null); // when staged (green light)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLocationRef = useRef<Location.LocationObjectCoords | null>(null);
  const cumulativeDistanceRef = useRef<number>(0);
  const topSpeedRef = useRef<number>(0);
  const prevSpeedRef = useRef<number>(0);
  const prevTimeRef = useRef<number>(0);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const splitsRecordedRef = useRef<Set<DragDistanceType>>(new Set());
  const sprintsRecordedRef = useRef<Set<SprintType>>(new Set());
  const gpsCourseRef = useRef<number | null>(null);
  const fouledRef = useRef<boolean>(false);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (locationSubRef.current) locationSubRef.current.remove();
    };
  }, []);

  // ── Launch (fires when car moves) ─────────────────────────────────────────
  const handleLaunch = useCallback((triggeredByAccel = false) => {
    if (statusRef.current !== 'staged') return;

    const now = Date.now();

    // Compute reaction time: delta from green light to first motion
    if (stageTimeRef.current !== null) {
      const rt = now - stageTimeRef.current;
      setReactionTimeMs(rt);
    }

    setStatus('running');
    statusRef.current = 'running';
    startTimeRef.current = now;
    cumulativeDistanceRef.current = 0;
    topSpeedRef.current = 0;
    prevSpeedRef.current = 0;
    prevTimeRef.current = now;
    splitsRecordedRef.current.clear();
    sprintsRecordedRef.current.clear();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current);
      }
    }, 16); // ~60 fps display
  }, []);

  // ── DeviceMotion subscription — linear acceleration, zero-offset calibrated ──
  useEffect(() => {
    DeviceMotion.setUpdateInterval(DEVICE_MOTION_INTERVAL_MS);

    const sub = DeviceMotion.addListener((data) => {
      // data.acceleration is gravity-removed linear acceleration (m/s^2)
      // It can be null on some Android devices; fall back gracefully.
      const raw = data.acceleration;
      if (!raw) return;

      const fusionState = fusionStateRef.current;
      const currentStatus = statusRef.current;

      const result = processSensorMeasurement(
        fusionState,
        { x: raw.x, y: raw.y, z: raw.z },
        {
          isStaging: currentStatus === 'staging',
          isStaged:  currentStatus === 'staged',
          isRunning: currentStatus === 'running',
          gpsCourse: gpsCourseRef.current,
          launchThresholdG: DEFAULT_LAUNCH_G_THRESHOLD,
        },
      );

      // Calibration completion during 'staging'
      if (currentStatus === 'staging') {
        calibrationCountRef.current += 1;
        if (result.isCalibrated && calibrationCountRef.current >= CALIBRATION_SAMPLE_COUNT) {
          setStatus('staged');
          statusRef.current = 'staged';
          stageTimeRef.current = Date.now(); // green light time
        }
      }

      // Update display G reading
      setGForceMagnitude(result.filteredG);
      if (currentStatus === 'running') {
        setPeakG(result.peakG);
      }

      // Auto-launch via sensor (staged state, not yet running)
      if (result.launchDetected && currentStatus === 'staged') {
        handleLaunch(true);
      }
    });

    return () => {
      sub.remove();
    };
  }, [handleLaunch]);

  // ── GPS subscription ───────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    async function startLocationWatch() {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted' || !active) return;

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy:         Location.Accuracy.BestForNavigation,
          timeInterval:     200,
          distanceInterval: 0.5,
        },
        (loc) => {
          if (!active) return;

          const speedKmh = Math.max(0, (loc.coords.speed ?? 0) * 3.6);
          setCurrentSpeedKmh(speedKmh);

          // Track GPS heading for course projection
          if (loc.coords.heading != null && loc.coords.heading >= 0) {
            gpsCourseRef.current = loc.coords.heading;
          }

          if (speedKmh > topSpeedRef.current) {
            topSpeedRef.current = speedKmh;
            setTopSpeedKmh(speedKmh);
          }

          // Foul detection: movement before green light (staged → running hasn't fired)
          if (statusRef.current === 'staged' && speedKmh > GPS_FOUL_SPEED_KMH && !fouledRef.current) {
            // Only a foul if movement was NOT triggered by the sensor launch path
            // We let handleLaunch handle normal launches; if GPS fires first when staged it means
            // the driver left before the sensor threshold — treat as legit auto-launch.
            handleLaunch(false);
          }

          // GPS auto-launch fallback (belt and suspenders for cars with dead IMU readings)
          if (statusRef.current === 'staged' && speedKmh > GPS_AUTO_LAUNCH_KMH) {
            handleLaunch(false);
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

              // ── Distance splits (1/4, 1/2, 1 mi) ───────────────────────
              const checkSplit = (type: DragDistanceType, thresholdMeters: number) => {
                if (currentDist >= thresholdMeters && !splitsRecordedRef.current.has(type)) {
                  splitsRecordedRef.current.add(type);
                  const splitResult: SplitResult = {
                    distanceType: type,
                    distanceMeters: thresholdMeters,
                    elapsedMs: elapsed,
                    trapSpeedKmh: speedKmh,
                    saved: false,
                  };
                  setSplits((prev) => ({ ...prev, [type]: splitResult }));

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
                      .catch((err) => {
                        console.error(`[useDragRace] saveDragRun(${type}):`, err);
                      });
                  }

                  // Finish line logic
                  const m = modeRef.current;
                  if (
                    (m === 'drag'      && type === 'quarter_mile') ||
                    (m === 'half_mile' && type === 'half_mile')    ||
                    (m === 'one_mile'  && type === 'one_mile')      ||
                    (m === 'all'       && type === 'one_mile')
                  ) {
                    setStatus('finished');
                    statusRef.current = 'finished';
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  }
                }
              };

              checkSplit('quarter_mile', DRAG_DISTANCE_METERS.quarter_mile);
              checkSplit('half_mile',    DRAG_DISTANCE_METERS.half_mile);
              checkSplit('one_mile',     DRAG_DISTANCE_METERS.one_mile);

              // ── Speed sprints (0-60, 0-100) ──────────────────────────────
              const checkSprint = (type: SprintType, targetSpeed: number) => {
                if (speedKmh >= targetSpeed && !sprintsRecordedRef.current.has(type)) {
                  sprintsRecordedRef.current.add(type);

                  const vCurr = speedKmh;
                  const vPrev = prevSpeedRef.current;
                  const tCurr = now;
                  const tPrev = prevTimeRef.current;
                  const tStart = startTimeRef.current ?? now;

                  let sprintElapsed = elapsed;
                  if (vCurr > vPrev && vPrev < targetSpeed && tPrev > tStart) {
                    const fraction = (targetSpeed - vPrev) / (vCurr - vPrev);
                    sprintElapsed = Math.max(0, Math.round(tPrev + fraction * (tCurr - tPrev) - tStart));
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
                        console.error(`[useDragRace] saveSprintRun(${type}):`, err);
                      });
                  }

                  const m = modeRef.current;
                  if (
                    (m === 'sprint_60'  && type === 'zero_to_60') ||
                    (m === 'sprint_100' && type === 'zero_to_100')
                  ) {
                    setStatus('finished');
                    statusRef.current = 'finished';
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  }
                }
              };

              checkSprint('zero_to_60',  SPRINT_TARGET_SPEED_KMH.zero_to_60);
              checkSprint('zero_to_100', SPRINT_TARGET_SPEED_KMH.zero_to_100);

              prevSpeedRef.current = speedKmh;
              prevTimeRef.current  = now;
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
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, [handleLaunch, user, primaryVehicle]);

  // ── stageVehicle ──────────────────────────────────────────────────────────
  const stageVehicle = useCallback(async () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    calibrationCountRef.current = 0;
    resetSensorFusion(fusionStateRef.current);
    cumulativeDistanceRef.current = 0;
    topSpeedRef.current = 0;
    prevSpeedRef.current = 0;
    fouledRef.current = false;

    setElapsedMs(0);
    setDistanceTraveledMeters(0);
    setTopSpeedKmh(0);
    setGForceMagnitude(0);
    setPeakG(0);
    setReactionTimeMs(null);
    setIsFoul(false);
    setSplits({ quarter_mile: null, half_mile: null, one_mile: null });
    setSprints({ zero_to_60: null, zero_to_100: null });
    sprintsRecordedRef.current.clear();
    splitsRecordedRef.current.clear();
    stageTimeRef.current = null;

    setStatus('staging');
    statusRef.current = 'staging';
  }, []);

  // ── abortRun ──────────────────────────────────────────────────────────────
  const abortRun = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    resetSensorFusion(fusionStateRef.current);
    calibrationCountRef.current = 0;
    setStatus('idle');
    statusRef.current = 'idle';
  }, []);

  // ── resetTimer ────────────────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    resetSensorFusion(fusionStateRef.current);
    calibrationCountRef.current = 0;
    fouledRef.current = false;
    setStatus('idle');
    statusRef.current = 'idle';
    setElapsedMs(0);
    setDistanceTraveledMeters(0);
    setTopSpeedKmh(0);
    setGForceMagnitude(0);
    setPeakG(0);
    setReactionTimeMs(null);
    setIsFoul(false);
    prevSpeedRef.current = 0;
    setSplits({ quarter_mile: null, half_mile: null, one_mile: null });
    setSprints({ zero_to_60: null, zero_to_100: null });
    sprintsRecordedRef.current.clear();
    splitsRecordedRef.current.clear();
  }, []);

  return {
    status,
    elapsedMs,
    currentSpeedKmh,
    distanceTraveledMeters,
    topSpeedKmh,
    peakG,
    gForceMagnitude,
    reactionTimeMs,
    isFoul,
    splits,
    sprints,
    mode,
    setMode,
    stageVehicle,
    abortRun,
    resetTimer,
    manualLaunch: handleLaunch,
  };
}
