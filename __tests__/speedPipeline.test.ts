import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SpeedPipeline, type RawGpsFix } from '../utils/speedPipeline.ts';

describe('Speed & Distance Pipeline', () => {
  it('requires 3 consecutive good fixes before displaying speed (shows dash / null)', () => {
    const pipeline = new SpeedPipeline();

    // Fix 1: accurate fix (accuracy 8m), Doppler speed 10 m/s (~36 km/h)
    const fix1: RawGpsFix = {
      latitude: -1.2921,
      longitude: 36.8219,
      speed: 10,
      accuracy: 8,
      timestamp: 1000,
    };
    const out1 = pipeline.processFix(fix1);
    assert.strictEqual(out1.displaySpeedKmh, null, 'Fix 1 must not display speed yet');
    assert.strictEqual(out1.quality, 'acquiring');
    assert.strictEqual(out1.consecutiveGoodFixes, 1);

    // Fix 2: accurate fix (accuracy 9m), Doppler speed 10 m/s
    const fix2: RawGpsFix = {
      latitude: -1.2923,
      longitude: 36.8221,
      speed: 10,
      accuracy: 9,
      timestamp: 2000,
    };
    const out2 = pipeline.processFix(fix2);
    assert.strictEqual(out2.displaySpeedKmh, null, 'Fix 2 must not display speed yet');
    assert.strictEqual(out2.consecutiveGoodFixes, 2);

    // Fix 3: 3rd consecutive good fix
    const fix3: RawGpsFix = {
      latitude: -1.2925,
      longitude: 36.8223,
      speed: 10,
      accuracy: 9,
      timestamp: 3000,
    };
    const out3 = pipeline.processFix(fix3);
    assert.notStrictEqual(out3.displaySpeedKmh, null, 'Fix 3 must unlock speed');
    assert.strictEqual(out3.consecutiveGoodFixes, 3);
    assert.strictEqual(out3.quality, 'good');
    assert.ok(out3.displaySpeedKmh! >= 30, 'Speed must be approximately 36 km/h');
  });

  it('keeps stationary phone clamped at 0 km/h and distance at 0.00m despite sensor noise and wandering', () => {
    const pipeline = new SpeedPipeline();

    // Baseline stationary coordinates with GPS coordinate jitter and phantom noise speed
    const baseLat = -1.2921;
    const baseLng = 36.8219;

    // Simulate 10 stationary fixes on a parked phone:
    // Speed fluctuates around 0.3 - 1.6 m/s (~1 - 5.7 km/h), position wanders 2 - 8 meters
    for (let i = 0; i < 10; i++) {
      const fix: RawGpsFix = {
        latitude: baseLat + (Math.sin(i) * 0.00004), // ~4 meters displacement jitter
        longitude: baseLng + (Math.cos(i) * 0.00004),
        speed: 0.5 + (i % 3) * 0.3, // 0.5 to 1.1 m/s (< 2.0 m/s clamp)
        accuracy: 12 + (i % 4), // 12-15m accuracy
        timestamp: 1000 + i * 1000,
      };

      const out = pipeline.processFix(fix, 0.001); // Still accelerometer variance = 0.001
      if (out.displaySpeedKmh !== null) {
        assert.strictEqual(out.displaySpeedKmh, 0, `Stationary fix ${i} must show 0 km/h`);
      }
      assert.strictEqual(out.isStationary, true, `Fix ${i} must be flagged stationary`);
      assert.strictEqual(out.totalDistanceMeters, 0, `Distance must remain 0.00m while parked`);
    }
  });

  it('tracks a real drive accurately: accelerations, sustained speed, and distance accumulation', () => {
    const pipeline = new SpeedPipeline();
    const startTime = 10000;

    // Drive segment: accelerating from 10 m/s (36 km/h) to 25 m/s (90 km/h)
    // Moving roughly south along meridian: ~0.00022 deg lat per 25 meters
    let lat = -1.2920;
    const lng = 36.8219;

    let lastOut = null;
    for (let i = 0; i < 10; i++) {
      lat -= 0.00022; // ~24.5 meters per second
      const fix: RawGpsFix = {
        latitude: lat,
        longitude: lng,
        speed: 25.0, // 25 m/s = 90 km/h
        accuracy: 8, // excellent accuracy
        timestamp: startTime + i * 1000,
      };
      // Active driving accelerometer variance: ~0.04
      lastOut = pipeline.processFix(fix, 0.04);
    }

    assert.ok(lastOut !== null);
    assert.strictEqual(lastOut!.quality, 'good');
    assert.strictEqual(lastOut!.isStationary, false);
    // 90 km/h
    assert.ok(lastOut!.displaySpeedKmh! >= 85 && lastOut!.displaySpeedKmh! <= 92);
    // 7 moves of ~24.5m after acquisition lock = ~171m
    assert.ok(lastOut!.totalDistanceMeters > 150 && lastOut!.totalDistanceMeters < 200);
    assert.ok(lastOut!.topSpeedKmh >= 85);
  });

  it('handles tunnel loss and weak GPS without corrupting metrics or jumping', () => {
    const pipeline = new SpeedPipeline();

    // 1. Establish good lock
    for (let i = 0; i < 3; i++) {
      pipeline.processFix({
        latitude: -1.2920 - i * 0.0002,
        longitude: 36.8219,
        speed: 20,
        accuracy: 8,
        timestamp: 1000 + i * 1000,
      });
    }

    const distBeforeTunnel = pipeline.getStatus().totalDistanceMeters;

    // 2. Enter tunnel: accuracy degrades to 65m, fix coordinates jump wildly
    const tunnelFix: RawGpsFix = {
      latitude: -1.3500, // 6km jump!
      longitude: 36.9000,
      speed: 35,
      accuracy: 65, // > 25m threshold
      timestamp: 4000,
    };

    const tunnelOut = pipeline.processFix(tunnelFix);
    assert.strictEqual(tunnelOut.quality, 'weak');
    assert.strictEqual(tunnelOut.displaySpeedKmh, null, 'In tunnel / weak GPS, speed should display dash');
    assert.strictEqual(tunnelOut.consecutiveGoodFixes, 0, 'Consecutive count must reset');
    assert.strictEqual(tunnelOut.totalDistanceMeters, distBeforeTunnel, 'Distance must NOT accumulate wild tunnel jump');
  });

  it('rejects a poor first fix (> 25m accuracy)', () => {
    const pipeline = new SpeedPipeline();

    const poorFix: RawGpsFix = {
      latitude: -1.2921,
      longitude: 36.8219,
      speed: 15,
      accuracy: 42, // weak GPS
      timestamp: 1000,
    };

    const out = pipeline.processFix(poorFix);
    assert.strictEqual(out.displaySpeedKmh, null);
    assert.strictEqual(out.quality, 'weak');
    assert.strictEqual(out.consecutiveGoodFixes, 0);
    assert.strictEqual(out.totalDistanceMeters, 0);
  });

  it('resets all metrics back to idle when reset() is called on ending drive', () => {
    const pipeline = new SpeedPipeline();

    // Run active drive
    for (let i = 0; i < 5; i++) {
      pipeline.processFix({
        latitude: -1.2920 - i * 0.0002,
        longitude: 36.8219,
        speed: 20,
        accuracy: 8,
        timestamp: 1000 + i * 1000,
      });
    }

    assert.ok(pipeline.getStatus().totalDistanceMeters > 0);
    assert.ok(pipeline.getStatus().topSpeedKmh > 0);

    // Call reset
    pipeline.reset();

    const status = pipeline.getStatus();
    assert.strictEqual(status.consecutiveGoodFixes, 0);
    assert.strictEqual(status.totalDistanceMeters, 0);
    assert.strictEqual(status.topSpeedKmh, 0);
  });
});
