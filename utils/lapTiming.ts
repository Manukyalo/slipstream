/**
 * Lap Timing & Geofencing Math Engine
 *
 * Implements:
 * 1. Haversine spherical distance calculation
 * 2. Angular heading difference with wrap-around [0, 180]
 * 3. Line segment crossing detection with 2D geometric intersection & fractional time interpolation
 * 4. Circular proximity gate crossing with heading tolerance check
 * 5. Millisecond lap time formatting (M:SS.mmm)
 * 6. Best-lap delta calculation (+0.412 / -0.050)
 */

export const CROSSING_RADIUS_METERS = 30; // tight for start/finish accuracy
export const HEADING_TOLERANCE_DEG = 40; // ± 40° around defined heading

/**
 * Calculate the great-circle distance between two points in meters using Haversine formula.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the absolute angular difference between two headings [0, 180].
 */
export function headingDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Determines if the current GPS position counts as crossing a defined gate.
 * Conditions:
 *  1. Distance from gate centre < CROSSING_RADIUS_METERS
 *  2. If gate has a required heading, current heading must be within HEADING_TOLERANCE
 */
export function isCrossingGate(opts: {
  currentLat: number;
  currentLon: number;
  currentHeading: number | null;
  gateLat: number;
  gateLon: number;
  gateHeading: number | null;
}): boolean {
  const dist = haversineMeters(
    opts.currentLat,
    opts.currentLon,
    opts.gateLat,
    opts.gateLon,
  );

  if (dist > CROSSING_RADIUS_METERS) return false;

  if (opts.gateHeading !== null && opts.currentHeading !== null) {
    const diff = headingDiff(opts.currentHeading, opts.gateHeading);
    if (diff > HEADING_TOLERANCE_DEG) return false;
  }

  return true;
}

/**
 * Robust line-crossing detection with GPS interpolation.
 * Determines if the trajectory segment from (prevLat, prevLon) to (currLat, currLon)
 * intersected the physical gate line spanning width gateWidthMeters (default 40m).
 *
 * Returns { crossed: boolean; fraction: number } where fraction is [0, 1] between prev and curr sample.
 */
export function detectSegmentCrossing(opts: {
  prevLat: number;
  prevLon: number;
  currLat: number;
  currLon: number;
  currHeading: number | null;
  gateLat: number;
  gateLon: number;
  gateHeading: number | null;
  gateWidthMeters?: number;
}): { crossed: boolean; fraction: number } {
  // Heading verification if gate has a specified orientation
  if (opts.gateHeading !== null && opts.currHeading !== null) {
    const diff = headingDiff(opts.currHeading, opts.gateHeading);
    if (diff > HEADING_TOLERANCE_DEG) {
      return { crossed: false, fraction: 1 };
    }
  }

  // Equirectangular local projection around the gate in metres
  const latMid = (opts.gateLat * Math.PI) / 180;
  const mPerDegLon = 111320 * Math.cos(latMid);
  const mPerDegLat = 110540;

  // Car segment [P1 -> P2]
  const p1x = (opts.prevLon - opts.gateLon) * mPerDegLon;
  const p1y = (opts.prevLat - opts.gateLat) * mPerDegLat;
  const p2x = (opts.currLon - opts.gateLon) * mPerDegLon;
  const p2y = (opts.currLat - opts.gateLat) * mPerDegLat;

  // Gate segment [G1 -> G2] (line perpendicular to gate heading)
  const halfWidth = (opts.gateWidthMeters ?? 40) / 2;
  const headingRad = opts.gateHeading !== null ? (opts.gateHeading * Math.PI) / 180 : 0;
  // Perpendicular angle
  const perpRad = headingRad + Math.PI / 2;
  const dx = halfWidth * Math.sin(perpRad);
  const dy = halfWidth * Math.cos(perpRad);

  const g1x = -dx;
  const g1y = -dy;
  const g2x = dx;
  const g2y = dy;

  // Segment intersection test: P1->P2 with G1->G2
  const rX = p2x - p1x;
  const rY = p2y - p1y;
  const sX = g2x - g1x;
  const sY = g2y - g1y;

  const denom = rX * sY - rY * sX;

  if (Math.abs(denom) > 1e-6) {
    const u = ((g1x - p1x) * rY - (g1y - p1y) * rX) / denom;
    const t = ((g1x - p1x) * sY - (g1y - p1y) * sX) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { crossed: true, fraction: t };
    }
  }

  // Proximity fallback if stationary or within tight gate circle
  const dist = haversineMeters(opts.currLat, opts.currLon, opts.gateLat, opts.gateLon);
  if (dist <= (opts.gateWidthMeters ?? 40) / 2) {
    return { crossed: true, fraction: 1 };
  }

  return { crossed: false, fraction: 1 };
}

/** Format milliseconds as M:SS.mmm */
export function formatLapTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const millis = Math.floor(ms % 1000);
  return `${mins}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/** Returns the delta string vs best lap: e.g. "+0.412" or "-0.050" */
export function lapDelta(lapMs: number, bestMs: number): string {
  const delta = (lapMs - bestMs) / 1000;
  return delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
}
