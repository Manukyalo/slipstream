import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  msToKmh,
  calculateDistanceMeters,
  computeTripMetrics,
  samplesToLineStringWkt,
  type GpsSample,
} from '../utils/telemetry.ts';

describe('Telemetry & GPS Math', () => {
  it('converts m/s to km/h accurately', () => {
    assert.strictEqual(msToKmh(0), 0);
    assert.strictEqual(msToKmh(-5), 0);
    // 27.7778 m/s = 100 km/h
    assert.ok(Math.abs(msToKmh(27.777778) - 100) < 0.01);
    // 60 mph = 26.8224 m/s -> 96.5606 km/h
    assert.ok(Math.abs(msToKmh(26.8224) - 96.56) < 0.01);
  });

  it('calculates Haversine distance between coordinates accurately', () => {
    // Nairobi Uhuru Park (-1.2921, 36.8219) to Nairobi City Stadium (-1.2981, 36.8458)
    const dist = calculateDistanceMeters(-1.2921, 36.8219, -1.2981, 36.8458);
    // ~2.73 km (2730m)
    assert.ok(dist > 2600 && dist < 2850, `Distance ${dist}m should be ~2.73km`);

    // Zero distance for identical points
    assert.strictEqual(calculateDistanceMeters(0, 0, 0, 0), 0);
  });

  it('filters out GPS anomaly jumps (>150m in 1s)', () => {
    const startTime = 1000000;
    const samples: GpsSample[] = [
      { latitude: -1.2921, longitude: 36.8219, speed: 20, timestamp: startTime },
      { latitude: -1.2923, longitude: 36.8221, speed: 20, timestamp: startTime + 1000 },
      // Anomaly spike to Mombasa (~450km away) for 1 sample
      { latitude: -4.0435, longitude: 39.6682, speed: 20, timestamp: startTime + 2000 },
      // Returns back to path
      { latitude: -1.2925, longitude: 36.8223, speed: 20, timestamp: startTime + 3000 },
    ];

    const metrics = computeTripMetrics(samples, startTime, startTime + 3000);
    // Should NOT include the 450km jump
    assert.ok(metrics.distanceMeters < 1000, `Distance ${metrics.distanceMeters}m should filter GPS jump`);
  });

  it('computes correct speed buckets, top speed, and duration', () => {
    const startTime = 1000000;
    const samples: GpsSample[] = [
      { latitude: -1.2920, longitude: 36.8219, speed: 5, timestamp: startTime }, // 18 km/h -> 0-40 bucket
      { latitude: -1.2922, longitude: 36.8221, speed: 15, timestamp: startTime + 2000 }, // 54 km/h -> 40-80 bucket
      { latitude: -1.2924, longitude: 36.8223, speed: 28, timestamp: startTime + 4000 }, // 100.8 km/h -> 80-120 bucket
      { latitude: -1.2926, longitude: 36.8225, speed: 38, timestamp: startTime + 6000 }, // 136.8 km/h -> 120+ bucket
    ];

    const metrics = computeTripMetrics(samples, startTime, startTime + 6000);
    assert.strictEqual(metrics.durationSeconds, 6);
    assert.strictEqual(metrics.topSpeedKmh, 136.8);
    assert.strictEqual(metrics.speedBuckets.length, 4);

    // Each bucket had 1 sample out of 4 (25%)
    metrics.speedBuckets.forEach((b) => {
      assert.strictEqual(b.percentage, 25);
    });
  });

  it('generates valid PostGIS WKT LINESTRING format', () => {
    const samples: GpsSample[] = [
      { latitude: -1.2921, longitude: 36.8219, speed: 10, timestamp: 1 },
      { latitude: -1.2922, longitude: 36.8220, speed: 12, timestamp: 2 },
    ];

    const wkt = samplesToLineStringWkt(samples);
    assert.ok(wkt?.startsWith('SRID=4326;LINESTRING('));
    assert.ok(wkt?.includes('36.821900 -1.292100'));
  });
});
