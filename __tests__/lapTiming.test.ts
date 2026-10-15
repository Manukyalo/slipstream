import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  haversineMeters,
  headingDiff,
  isCrossingGate,
  detectSegmentCrossing,
  formatLapTime,
  lapDelta,
  CROSSING_RADIUS_METERS,
  HEADING_TOLERANCE_DEG,
} from '../utils/lapTiming.ts';

describe('Lap Timing & Geofencing Math', () => {
  it('formats lap times into M:SS.mmm format correctly', () => {
    // 1 min 24 sec 512 ms = 84512 ms
    assert.strictEqual(formatLapTime(84512), '1:24.512');
    // Sub-minute: 59 sec 005 ms = 59005 ms
    assert.strictEqual(formatLapTime(59005), '0:59.005');
    // Multi-minute: 2 min 03 sec 040 ms = 123040 ms
    assert.strictEqual(formatLapTime(123040), '2:03.040');
  });

  it('computes lap deltas vs session best lap correctly', () => {
    // 0.412s slower than best
    assert.strictEqual(lapDelta(84924, 84512), '+0.412');
    // 0.050s faster than best (negative delta)
    assert.strictEqual(lapDelta(84462, 84512), '-0.050');
    // Exact match
    assert.strictEqual(lapDelta(84512, 84512), '+0.000');
  });

  it('calculates heading differences across the 0/360 degree boundary', () => {
    // Normal difference
    assert.strictEqual(headingDiff(90, 110), 20);
    assert.strictEqual(headingDiff(110, 90), 20);

    // Across 0/360 wrap: 355 deg to 10 deg is 15 deg
    assert.strictEqual(headingDiff(355, 10), 15);
    assert.strictEqual(headingDiff(10, 355), 15);

    // Opposite directions
    assert.strictEqual(headingDiff(0, 180), 180);
    assert.strictEqual(headingDiff(10, 190), 180);
  });

  it('validates circular gate crossing proximity and heading filters', () => {
    const gateLat = -1.2921;
    const gateLon = 36.8219;
    const gateHeading = 90; // Eastbound gate

    // 1. Car right at gate, driving East (90 deg) -> True
    assert.strictEqual(
      isCrossingGate({
        currentLat: gateLat,
        currentLon: gateLon,
        currentHeading: 95,
        gateLat,
        gateLon,
        gateHeading,
      }),
      true,
    );

    // 2. Car right at gate, driving West (270 deg - wrong way!) -> False
    assert.strictEqual(
      isCrossingGate({
        currentLat: gateLat,
        currentLon: gateLon,
        currentHeading: 270,
        gateLat,
        gateLon,
        gateHeading,
      }),
      false,
    );

    // 3. Car 50m away from gate (outside 30m radius) -> False
    // 0.0005 deg lat is ~55 meters
    assert.strictEqual(
      isCrossingGate({
        currentLat: gateLat + 0.0005,
        currentLon: gateLon,
        currentHeading: 90,
        gateLat,
        gateLon,
        gateHeading,
      }),
      false,
    );
  });

  it('detects line segment gate crossing with high-precision time interpolation', () => {
    // Gate at origin (0, 0) oriented North (heading 0 deg)
    // Physical line spans 40m East-West (perpendicular to North heading)
    const gateLat = 0.0;
    const gateLon = 0.0;
    const gateHeading = 0; // Heading North

    // Car drives North from 20m South to 20m North of gate
    // 1 deg lat is ~110540m -> 20m is ~0.0001809 deg
    const prevLat = -0.000181;
    const prevLon = 0.0;
    const currLat = 0.000181;
    const currLon = 0.0;
    const currHeading = 0;

    const result = detectSegmentCrossing({
      prevLat,
      prevLon,
      currLat,
      currLon,
      currHeading,
      gateLat,
      gateLon,
      gateHeading,
      gateWidthMeters: 40,
    });

    assert.strictEqual(result.crossed, true, 'Vehicle trajectory should cross the gate');
    // Since prev is -20m and curr is +20m, crossing should be right around the middle (~0.5 fraction)
    assert.ok(
      Math.abs(result.fraction - 0.5) < 0.05,
      `Interpolation fraction ${result.fraction} should be ~0.5`,
    );
  });

  it('rejects gate crossing when trajectory misses the gate width', () => {
    const gateLat = 0.0;
    const gateLon = 0.0;
    const gateHeading = 0; // Heading North

    // Car drives North parallel to gate line, but 50m to the East (gate width is 40m, half-width is 20m)
    // 50m at equator is ~0.00045 deg lon
    const prevLat = -0.000181;
    const prevLon = 0.00045;
    const currLat = 0.000181;
    const currLon = 0.00045;
    const currHeading = 0;

    const result = detectSegmentCrossing({
      prevLat,
      prevLon,
      currLat,
      currLon,
      currHeading,
      gateLat,
      gateLon,
      gateHeading,
      gateWidthMeters: 40,
    });

    assert.strictEqual(result.crossed, false, 'Vehicle outside gate width should not trigger crossing');
  });

  it('rejects crossing when vehicle heading violates gate orientation tolerance', () => {
    const gateLat = 0.0;
    const gateLon = 0.0;
    const gateHeading = 0; // Gate expects Northbound (0 deg)

    // Car crosses physical line driving South (180 deg) - e.g. wrong way on circuit
    const prevLat = 0.000181;
    const prevLon = 0.0;
    const currLat = -0.000181;
    const currLon = 0.0;
    const currHeading = 180;

    const result = detectSegmentCrossing({
      prevLat,
      prevLon,
      currLat,
      currLon,
      currHeading,
      gateLat,
      gateLon,
      gateHeading,
      gateWidthMeters: 40,
    });

    assert.strictEqual(result.crossed, false, 'Wrong-way crossing must be rejected by heading tolerance');
  });
});
