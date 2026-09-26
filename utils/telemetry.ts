/**
 * Telemetry Math and Geospatial Utilities
 */

export interface GpsSample {
  latitude: number;
  longitude: number;
  speed: number; // m/s from Location sensor
  timestamp: number; // epoch ms
}

export interface SpeedBucket {
  range: string;
  percentage: number;
  durationSeconds: number;
}

export interface TripMetrics {
  distanceMeters: number;
  durationSeconds: number;
  topSpeedKmh: number;
  avgSpeedKmh: number;
  speedBuckets: SpeedBucket[];
  lineStringWkt: string | null;
}

/** Convert m/s to km/h */
export function msToKmh(ms: number): number {
  if (!ms || ms < 0) return 0;
  return ms * 3.6;
}

/** Calculate distance between two lat/lon points via Haversine formula (meters) */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Build PostGIS WKT LINESTRING from array of GPS samples */
export function samplesToLineStringWkt(samples: GpsSample[]): string | null {
  if (samples.length < 2) return null;
  const coords = samples.map((s) => `${s.longitude.toFixed(6)} ${s.latitude.toFixed(6)}`).join(', ');
  return `SRID=4326;LINESTRING(${coords})`;
}

/** Convert samples to GeoJSON Feature<LineString> for MapLibre live rendering */
export function samplesToGeoJsonLine(samples: GpsSample[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  if (samples.length < 2) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
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

/** Compute trip summary telemetry from client-buffered samples */
export function computeTripMetrics(
  samples: GpsSample[],
  startTime: number,
  endTime: number
): TripMetrics {
  const durationSeconds = Math.max(1, Math.round((endTime - startTime) / 1000));

  if (samples.length === 0) {
    return {
      distanceMeters: 0,
      durationSeconds,
      topSpeedKmh: 0,
      avgSpeedKmh: 0,
      speedBuckets: [],
      lineStringWkt: null,
    };
  }

  let totalDistance = 0;
  let topSpeedMs = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.speed > topSpeedMs) {
      topSpeedMs = s.speed;
    }

    if (i > 0) {
      const prev = samples[i - 1];
      const d = calculateDistanceMeters(
        prev.latitude,
        prev.longitude,
        s.latitude,
        s.longitude
      );
      // Filter out GPS jump anomalies (>150 m in ~1 sec = 540 km/h)
      if (d < 150) {
        totalDistance += d;
      }
    }
  }

  const avgSpeedMs = totalDistance > 0 ? totalDistance / durationSeconds : 0;
  const topSpeedKmh = Number(msToKmh(topSpeedMs).toFixed(1));
  const avgSpeedKmh = Number(msToKmh(avgSpeedMs).toFixed(1));

  // Speed-distribution breakdown (e.g., 0-40 km/h, 40-80 km/h, 80-120 km/h, 120+ km/h)
  const buckets = [
    { label: '0–40 km/h', min: 0, max: 40, count: 0 },
    { label: '40–80 km/h', min: 40, max: 80, count: 0 },
    { label: '80–120 km/h', min: 80, max: 120, count: 0 },
    { label: '120+ km/h', min: 120, max: Infinity, count: 0 },
  ];

  samples.forEach((s) => {
    const kmh = msToKmh(s.speed);
    const bucket = buckets.find((b) => kmh >= b.min && kmh < b.max);
    if (bucket) bucket.count++;
  });

  const speedBuckets: SpeedBucket[] = buckets.map((b) => ({
    range: b.label,
    percentage: samples.length > 0 ? Math.round((b.count / samples.length) * 100) : 0,
    durationSeconds: Math.round((b.count / (samples.length || 1)) * durationSeconds),
  }));

  return {
    distanceMeters: Number(totalDistance.toFixed(1)),
    durationSeconds,
    topSpeedKmh,
    avgSpeedKmh,
    speedBuckets,
    lineStringWkt: samplesToLineStringWkt(samples),
  };
}
