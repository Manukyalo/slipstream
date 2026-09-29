/**
 * useLapTimer — Phase 14
 *
 * Manages a live lap timing session against a defined track.
 * Responsibilities:
 *  - High-frequency (500 ms) lap timer driven by Date.now()
 *  - Start/finish crossing detection with proximity + optional heading check
 *  - Sector split detection
 *  - Accumulates completed laps with best-lap tracking
 *  - Saves each completed lap to Supabase via trackDay service
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CROSSING_RADIUS_METERS,
  formatLapTime,
  isCrossingGate,
  saveLap,
  type Lap,
  type SectorSplit,
  type Track,
  type TrackPoint,
} from '@/services/trackDay';

export interface LiveLapState {
  /** Current lap elapsed time in ms */
  currentLapMs: number;
  /** Sector splits for the lap in progress */
  pendingSectors: SectorSplit[];
  /** All completed laps this session, newest first */
  completedLaps: Lap[];
  /** Index into completedLaps of the personal-best lap */
  bestLapIndex: number | null;
  /** Is a session active? */
  isRunning: boolean;
  /** Have we seen at least one crossing? (gates the timer) */
  hasStarted: boolean;
}

export interface UseLapTimerOptions {
  track: Track | null;
  vehicleId?: string | null;
  /** Current GPS coords from the location subscription */
  currentLat: number | null;
  currentLon: number | null;
  currentHeading: number | null;
  /** Raw GPS point being appended to the path */
  isActive: boolean; // caller controls session on/off
}

const TIMER_INTERVAL_MS = 200; // 5 Hz — smooth enough without draining battery
/** After crossing, ignore re-trigger for this many ms */
const CROSSING_COOLDOWN_MS = 8_000;

export function useLapTimer({
  track,
  vehicleId,
  currentLat,
  currentLon,
  currentHeading,
  isActive,
}: UseLapTimerOptions) {
  const [state, setState] = useState<LiveLapState>({
    currentLapMs: 0,
    pendingSectors: [],
    completedLaps: [],
    bestLapIndex: null,
    isRunning: false,
    hasStarted: false,
  });

  // Refs so the interval closure always has fresh values
  const lapStartRef      = useRef<number | null>(null);
  const sectorStartRef   = useRef<number | null>(null);
  const pendingSectorsRef = useRef<SectorSplit[]>([]);
  const pathPointsRef    = useRef<TrackPoint[]>([]);
  const lastCrossingRef  = useRef<number>(0);
  const completedLapsRef = useRef<Lap[]>([]);
  const bestLapMsRef     = useRef<number | null>(null);
  const hasStartedRef    = useRef(false);

  // ── Timer tick ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !hasStartedRef.current) return;

    const interval = setInterval(() => {
      if (!lapStartRef.current) return;
      const elapsed = Date.now() - lapStartRef.current;
      setState((prev) => ({ ...prev, currentLapMs: elapsed }));
    }, TIMER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isActive, state.hasStarted]);

  // ── Gate crossing detection ───────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !track || currentLat === null || currentLon === null) return;

    const now = Date.now();
    const cooldownOk = now - lastCrossingRef.current > CROSSING_COOLDOWN_MS;
    if (!cooldownOk) return;

    // Append to path
    pathPointsRef.current.push({
      lat: currentLat, lon: currentLon,
      heading: currentHeading ?? undefined,
    });

    // ── Check start/finish crossing ──────────────────────────────────────
    const sfp = track.startFinishPoint;
    const crossed = isCrossingGate({
      currentLat,
      currentLon,
      currentHeading,
      gateLat: sfp.lat,
      gateLon: sfp.lon,
      gateHeading: track.startFinishHeading ?? null,
    });

    if (crossed) {
      lastCrossingRef.current = now;

      if (!hasStartedRef.current) {
        // First crossing — start the timer
        hasStartedRef.current = true;
        lapStartRef.current = now;
        sectorStartRef.current = now;
        pendingSectorsRef.current = [];
        pathPointsRef.current = [];
        setState((prev) => ({
          ...prev,
          hasStarted: true,
          isRunning: true,
          currentLapMs: 0,
          pendingSectors: [],
        }));
        return;
      }

      // Subsequent crossing — complete the lap
      const lapMs = now - (lapStartRef.current ?? now);
      completeLap(lapMs, now);
      return;
    }

    // ── Check sector crossings ───────────────────────────────────────────
    if (!hasStartedRef.current || !track.sectorPoints.length) return;

    const nextSectorIdx = pendingSectorsRef.current.length;
    if (nextSectorIdx >= track.sectorPoints.length) return;

    const sectorPoint = track.sectorPoints[nextSectorIdx];
    const sectorCrossed = isCrossingGate({
      currentLat,
      currentLon,
      currentHeading,
      gateLat: sectorPoint.lat,
      gateLon: sectorPoint.lon,
      gateHeading: sectorPoint.heading ?? null,
    });

    if (sectorCrossed) {
      lastCrossingRef.current = now;
      const splitMs = now - (sectorStartRef.current ?? now);
      sectorStartRef.current = now;
      const split: SectorSplit = { sectorIndex: nextSectorIdx, splitMs };
      pendingSectorsRef.current = [...pendingSectorsRef.current, split];
      setState((prev) => ({
        ...prev,
        pendingSectors: [...pendingSectorsRef.current],
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLat, currentLon, currentHeading, isActive, track]);

  // ── Complete Lap ──────────────────────────────────────────────────────────
  const completeLap = useCallback(
    async (lapMs: number, crossingTime: number) => {
      if (!track) return;

      const sectors = [...pendingSectorsRef.current];
      const path    = [...pathPointsRef.current];

      // Reset for next lap immediately — don't await the DB write
      lapStartRef.current    = crossingTime;
      sectorStartRef.current = crossingTime;
      pendingSectorsRef.current = [];
      pathPointsRef.current  = [];

      setState((prev) => ({
        ...prev,
        currentLapMs: 0,
        pendingSectors: [],
      }));

      // Optimistic local append (placeholder while saving)
      const tempLap: Lap = {
        id: `temp-${Date.now()}`,
        userId: '',
        vehicleId: vehicleId ?? null,
        trackId: track.id,
        lapTimeMs: lapMs,
        sectorTimes: sectors,
        pathPoints: path,
        recordedAt: new Date().toISOString(),
      };

      const newLaps = [tempLap, ...completedLapsRef.current];
      completedLapsRef.current = newLaps;

      const bestIdx = findBestLapIndex(newLaps);
      bestLapMsRef.current = bestIdx !== null ? newLaps[bestIdx].lapTimeMs : null;

      setState((prev) => ({
        ...prev,
        completedLaps: [...newLaps],
        bestLapIndex: bestIdx,
      }));

      // Persist to Supabase
      try {
        const saved = await saveLap({
          trackId: track.id,
          vehicleId: vehicleId ?? null,
          lapTimeMs: lapMs,
          sectorTimes: sectors,
          pathPoints: path,
        });
        // Replace temp lap with the saved one (has real ID)
        completedLapsRef.current = completedLapsRef.current.map((l) =>
          l.id === tempLap.id ? saved : l,
        );
        setState((prev) => ({
          ...prev,
          completedLaps: [...completedLapsRef.current],
        }));
      } catch (err) {
        console.error('[useLapTimer] Failed to save lap:', err);
        // Keep the optimistic local copy — the session summary still shows it
      }
    },
    [track, vehicleId],
  );

  const startSession = useCallback(() => {
    hasStartedRef.current = false;
    lapStartRef.current   = null;
    sectorStartRef.current = null;
    pendingSectorsRef.current = [];
    pathPointsRef.current = [];
    completedLapsRef.current  = [];
    bestLapMsRef.current  = null;

    setState({
      currentLapMs: 0,
      pendingSectors: [],
      completedLaps: [],
      bestLapIndex: null,
      isRunning: true,
      hasStarted: false,
    });
  }, []);

  const endSession = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  return { state, startSession, endSession, formatLapTime };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function findBestLapIndex(laps: Lap[]): number | null {
  if (!laps.length) return null;
  let best = 0;
  for (let i = 1; i < laps.length; i++) {
    if (laps[i].lapTimeMs < laps[best].lapTimeMs) best = i;
  }
  return best;
}

export { CROSSING_RADIUS_METERS };
