/**
 * Telemetry Math and Geospatial Utilities
 *
 * Pure functions — no side effects, no imports of React or RN.
 * All algorithms here are unit-testable.
 */

import type { FeatureCollection, LineString } from 'geojson';

// ─────────────────────────────────────────────────────────────────────────────
// Core types
// ─────────────────────────────────────────────────────────────────────────────

export interface GpsSample {
  latitude: number;
  longitude: number;
  speed: number;     // m/s from Location sensor
  timestamp: number; // epoch ms
  accuracy?: number; // GPS accuracy radius in metres (optional — not all platforms)
}

/** Per-point storage in the trips.route_points jsonb column */
export interface RoutePoint {
  lat: number;
  lng: number;
  speed_kmh: number;
}

export type PitStopTag = 'fuel' | 'food' | 'rest' | 'other';

/** Single pit stop — serialised to trips.pit_stops jsonb */
export interface PitStopRecord {
  id: string;
  lat: number;
  lng: number;
  started_at: string; // ISO 8601
  ended_at: string;   // ISO 8601
  duration_s: number;
  tag: PitStopTag | null;
  /** Where the car resumed — null if it didn't move during the stop */
  resume_lat: number | null;
  resume_lng: number | null;
}

export interface SpeedBucket {
  range: string;
  percentage: number;
  durationSeconds: number;
}

export interface TripMetrics {
  distanceMeters: number;
  durationSeconds: number;       // wall-clock (start → end, includes pit stops)
  movingTimeSeconds: number;     // wall-clock minus pit stop total
  topSpeedKmh: number;
  avgSpeedKmh: number;           // calculated against movingTimeSeconds
  pitStopCount: number;
  pitStopTotalSeconds: number;
  speedBuckets: SpeedBucket[];
  lineStringWkt: string | null;
  routePoints: RoutePoint[];     // downsampled + filtered
  startCoords?: [number, number] | null; // [lng, lat]
  endCoords?: [number, number] | null;   // [lng, lat]
  pitStops?: PitStopRecord[];
  clientId?: string;
  vehicleId?: string | null;
  tripId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit conversions
// ─────────────────────────────────────────────────────────────────────────────

/** Convert m/s to km/h */
export function msToKmh(ms: number): number {
  if (!ms || ms < 0) return 0;
  return ms * 3.6;
}

// ─────────────────────────────────────────────────────────────────────────────
// Haversine distance
// ─────────────────────────────────────────────────────────────────────────────

/** Distance between two lat/lon points in metres (Haversine) */
export function calculateDistanceMeters(
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

// ─────────────────────────────────────────────────────────────────────────────
// GPS noise filter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drop samples that are clearly GPS noise:
 *  - accuracy > 30 m (weak satellite fix)
 *  - impossible speed jump: > 150 m between consecutive samples when Δt < 1 s
 *    (i.e. implies velocity > 540 km/h — physically impossible)
 */
export function filterNoisySamples(samples: GpsSample[]): GpsSample[] {
  const out: GpsSample[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    // Drop poor-accuracy fixes
    if (s.accuracy !== undefined && s.accuracy > 30) continue;

    if (out.length > 0) {
      const prev = out[out.length - 1];
      const dtSec = Math.max(0.001, (s.timestamp - prev.timestamp) / 1000);
      const distM = calculateDistanceMeters(prev.latitude, prev.longitude, s.latitude, s.longitude);
      // Impossible jump: > 540 km/h implied speed
      if (distM / dtSec > 150) continue;
    }
    out.push(s);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Douglas-Peucker polyline simplification
// ─────────────────────────────────────────────────────────────────────────────

/** Perpendicular distance from point P to the line segment AB (metres) */
function perpendicularDistance(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number,
): number {
  const ab = calculateDistanceMeters(aLat, aLng, bLat, bLng);
  if (ab === 0) return calculateDistanceMeters(pLat, pLng, aLat, aLng);
  const ap = calculateDistanceMeters(pLat, pLng, aLat, aLng);
  const bp = calculateDistanceMeters(pLat, pLng, bLat, bLng);
  // Heron's formula for area, then h = 2A / base
  const s = (ab + ap + bp) / 2;
  const area = Math.sqrt(Math.max(0, s * (s - ab) * (s - ap) * (s - bp)));
  return (2 * area) / ab;
}

/**
 * Ramer-Douglas-Peucker simplification.
 * toleranceMeters ≈ 10 m keeps the route accurate while reducing point count ~80%.
 */
export function douglasPeucker(samples: GpsSample[], toleranceMeters = 10): GpsSample[] {
  if (samples.length <= 2) return samples;

  let maxDist = 0;
  let maxIdx = 0;
  const last = samples.length - 1;

  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(
      samples[i].latitude, samples[i].longitude,
      samples[0].latitude, samples[0].longitude,
      samples[last].latitude, samples[last].longitude,
    );
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > toleranceMeters) {
    const left  = douglasPeucker(samples.slice(0, maxIdx + 1), toleranceMeters);
    const right = douglasPeucker(samples.slice(maxIdx),         toleranceMeters);
    // Merge, removing duplicate at junction
    return [...left.slice(0, -1), ...right];
  }

  return [samples[0], samples[last]];
}

// ─────────────────────────────────────────────────────────────────────────────
// Route point builder
// ─────────────────────────────────────────────────────────────────────────────

/** Build the jsonb-serialisable route_points array from filtered, downsampled samples */
export function buildRoutePoints(samples: GpsSample[]): RoutePoint[] {
  return samples.map((s) => ({
    lat: s.latitude,
    lng: s.longitude,
    speed_kmh: Number(msToKmh(s.speed).toFixed(1)),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// WKT / GeoJSON builders
// ─────────────────────────────────────────────────────────────────────────────

/** Build PostGIS WKT LINESTRING for spatial indexing */
export function samplesToLineStringWkt(samples: GpsSample[]): string | null {
  if (samples.length < 2) return null;
  const coords = samples
    .map((s) => `${s.longitude.toFixed(6)} ${s.latitude.toFixed(6)}`)
    .join(', ');
  return `SRID=4326;LINESTRING(${coords})`;
}

/** Live rendering: solid-colour FeatureCollection for MapLibre breadcrumb */
export function samplesToGeoJsonLine(samples: GpsSample[]): FeatureCollection<LineString> {
  if (samples.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: samples.map((s) => [s.longitude, s.latitude]),
        },
      },
    ],
  };
}

/**
 * Speed-coloured route for recap snapshot.
 * Returns a FeatureCollection of 2-point LineString segments, each carrying
 * a `color` property so MapLibre can paint them individually.
 *
 * Speed thresholds (km/h):
 *   0–60   → cyan  (#22D3EE)
 *   60–100 → blue  (#3B82F6)
 *   100–140 → amber (#F59E0B)
 *   140+   → red   (#F43F5E)
 */
export function buildSpeedColouredGeoJson(points: RoutePoint[]): FeatureCollection<LineString> {
  if (points.length < 2) return { type: 'FeatureCollection', features: [] };

  const speedToColor = (kmh: number): string => {
    if (kmh < 60)  return '#22D3EE';
    if (kmh < 100) return '#3B82F6';
    if (kmh < 140) return '#F59E0B';
    return '#F43F5E';
  };

  return {
    type: 'FeatureCollection',
    features: points.slice(0, -1).map((p, i) => ({
      type: 'Feature' as const,
      properties: { color: speedToColor((p.speed_kmh + points[i + 1].speed_kmh) / 2) },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [p.lng, p.lat],
          [points[i + 1].lng, points[i + 1].lat],
        ],
      },
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip metrics computation
// ─────────────────────────────────────────────────────────────────────────────

export interface PitStopInterval {
  startMs: number;
  endMs: number;
}

/**
 * Compute trip summary telemetry.
 *
 * Pit stop intervals are used to:
 *  - Exclude in-stop samples from distance/speed calculations
 *  - Derive movingTimeSeconds = durationSeconds - Σ(pit stop durations)
 */
export function computeTripMetrics(
  samples: GpsSample[],
  startTime: number,
  endTime: number,
  pitStopIntervals: PitStopInterval[] = [],
): TripMetrics {
  const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));

  const pitStopTotalSeconds = Math.round(
    pitStopIntervals.reduce((sum, p) => sum + (p.endMs - p.startMs) / 1000, 0),
  );
  const movingTimeSeconds = Math.max(1, durationSeconds - pitStopTotalSeconds);
  const pitStopCount = pitStopIntervals.length;

  /** True if sample timestamp falls inside any pit stop window */
  const isDuringPitStop = (ts: number): boolean =>
    pitStopIntervals.some((p) => ts >= p.startMs && ts <= p.endMs);

  const filtered = filterNoisySamples(samples).filter((s) => !isDuringPitStop(s.timestamp));

  if (filtered.length === 0) {
    const downsampled = douglasPeucker(filterNoisySamples(samples));
    return {
      distanceMeters: 0,
      durationSeconds,
      movingTimeSeconds,
      topSpeedKmh: 0,
      avgSpeedKmh: 0,
      pitStopCount,
      pitStopTotalSeconds,
      speedBuckets: [],
      lineStringWkt: null,
      routePoints: buildRoutePoints(downsampled),
    };
  }

  let totalDistance = 0;
  let topSpeedMs = 0;

  for (let i = 0; i < filtered.length; i++) {
    const s = filtered[i];
    if (s.speed > topSpeedMs) topSpeedMs = s.speed;

    if (i > 0) {
      const prev = filtered[i - 1];
      const d = calculateDistanceMeters(prev.latitude, prev.longitude, s.latitude, s.longitude);
      // Secondary guard: skip GPS teleport jumps (> 150 m at any point)
      if (d < 150) totalDistance += d;
    }
  }

  const avgSpeedMs = totalDistance > 0 ? totalDistance / movingTimeSeconds : 0;
  const topSpeedKmh = Number(msToKmh(topSpeedMs).toFixed(1));
  const avgSpeedKmh = Number(msToKmh(avgSpeedMs).toFixed(1));

  const buckets = [
    { label: '0–60 km/h',   min: 0,   max: 60,       count: 0 },
    { label: '60–100 km/h', min: 60,  max: 100,       count: 0 },
    { label: '100–140 km/h',min: 100, max: 140,       count: 0 },
    { label: '140+ km/h',   min: 140, max: Infinity,  count: 0 },
  ];

  filtered.forEach((s) => {
    const kmh = msToKmh(s.speed);
    const bucket = buckets.find((b) => kmh >= b.min && kmh < b.max);
    if (bucket) bucket.count++;
  });

  const speedBuckets: SpeedBucket[] = buckets.map((b) => ({
    range: b.label,
    percentage: filtered.length > 0 ? Math.round((b.count / filtered.length) * 100) : 0,
    durationSeconds: Math.round((b.count / (filtered.length || 1)) * movingTimeSeconds),
  }));

  // Downsample full (unfiltered by pitstop) sample set for the stored route line
  const allFiltered = filterNoisySamples(samples);
  const downsampled  = douglasPeucker(allFiltered, 10);
  const routePoints  = buildRoutePoints(downsampled);

  return {
    distanceMeters: Number(totalDistance.toFixed(1)),
    durationSeconds,
    movingTimeSeconds,
    topSpeedKmh,
    avgSpeedKmh,
    pitStopCount,
    pitStopTotalSeconds,
    speedBuckets,
    lineStringWkt: samplesToLineStringWkt(downsampled),
    routePoints,
  };
}
