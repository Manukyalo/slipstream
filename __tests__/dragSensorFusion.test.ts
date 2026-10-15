import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createSensorFusionState,
  processSensorMeasurement,
  computeZeroOffset,
  applyZeroOffset,
  lowPassFilter,
  projectForwardG,
  STANDARD_GRAVITY_MPS2,
  type Vec3,
} from '../utils/dragSensorFusion.ts';

describe('Drag Sensor Fusion & Launch Detection', () => {
  // Recorded stationary samples with real-world MEMS sensor bias and idle vibrations
  const RECORDED_RESTING_SAMPLES: Vec3[] = [
    { x: 0.042, y: 0.118, z: 0.031 },
    { x: 0.048, y: 0.124, z: 0.027 },
    { x: 0.039, y: 0.115, z: 0.035 },
    { x: 0.044, y: 0.121, z: 0.029 },
    { x: 0.041, y: 0.119, z: 0.033 },
    { x: 0.046, y: 0.122, z: 0.028 },
    { x: 0.038, y: 0.117, z: 0.034 },
    { x: 0.043, y: 0.120, z: 0.030 },
    { x: 0.047, y: 0.125, z: 0.026 },
    { x: 0.040, y: 0.116, z: 0.032 },
    { x: 0.045, y: 0.121, z: 0.031 },
    { x: 0.042, y: 0.119, z: 0.029 },
    { x: 0.039, y: 0.114, z: 0.033 },
    { x: 0.046, y: 0.123, z: 0.028 },
    { x: 0.041, y: 0.118, z: 0.035 },
    { x: 0.044, y: 0.122, z: 0.030 },
    { x: 0.048, y: 0.126, z: 0.027 },
    { x: 0.037, y: 0.115, z: 0.034 },
    { x: 0.043, y: 0.120, z: 0.031 },
    { x: 0.045, y: 0.122, z: 0.029 },
    { x: 0.042, y: 0.119, z: 0.032 },
  ];

  it('calibrates zero offset and achieves resting G <= 0.03 G', () => {
    const state = createSensorFusionState();

    // 1. Process 20 staging samples to calibrate
    for (const sample of RECORDED_RESTING_SAMPLES.slice(0, 20)) {
      processSensorMeasurement(state, sample, { isStaging: true });
    }

    assert.strictEqual(state.isCalibrated, true, 'State should be calibrated after 20 samples');

    // Expected bias should closely match mean of samples (~0.043, ~0.120, ~0.030)
    assert.ok(Math.abs(state.bias.x - 0.043) < 0.01);
    assert.ok(Math.abs(state.bias.y - 0.120) < 0.01);

    // 2. Process resting samples in 'staged' mode and verify resting G
    for (let i = 0; i < 10; i++) {
      const restingSample = RECORDED_RESTING_SAMPLES[i % RECORDED_RESTING_SAMPLES.length];
      const result = processSensorMeasurement(state, restingSample, {
        isStaged: true,
        isRunning: false,
      });

      // Acceptance criterion: resting G reading is within 0.03 G of zero
      assert.ok(
        result.restingG <= 0.03,
        `Resting G reading ${result.restingG.toFixed(4)} G must be <= 0.03 G`,
      );
      assert.strictEqual(result.launchDetected, false, 'Stationary car must not trigger launch');
    }
  });

  it('detects a real launch event reliably and tracks peak G', () => {
    const state = createSensorFusionState();

    // Calibrate state first
    for (const sample of RECORDED_RESTING_SAMPLES.slice(0, 20)) {
      processSensorMeasurement(state, sample, { isStaging: true });
    }

    // Recorded real vehicle launch profile (m/s^2 forward surge)
    // 0.85G launch = ~8.33 m/s^2, 1.15G peak = ~11.28 m/s^2
    const LAUNCH_PROFILE: Vec3[] = [
      { x: 0.042, y: 0.119, z: 0.032 }, // stationary staged (~0.00 G)
      { x: 0.080, y: 1.500, z: 0.100 }, // clutch dump / torque converter stall (~0.15 G)
      { x: 0.150, y: 3.800, z: 0.200 }, // tire hook & launch surge (~0.39 G) -> triggers launch!
      { x: 0.200, y: 8.500, z: 0.350 }, // 1st gear full throttle (~0.87 G)
      { x: 0.220, y: 10.90, z: 0.400 }, // 1st gear peak torque (~1.11 G)
      { x: 0.220, y: 10.90, z: 0.400 }, // sustained
      { x: 0.220, y: 10.90, z: 0.400 }, // sustained
      { x: 0.220, y: 10.90, z: 0.400 }, // sustained
      { x: 0.220, y: 10.90, z: 0.400 }, // sustained
      { x: 0.180, y: 7.200, z: 0.250 }, // 1-2 shift recovery (~0.73 G)
    ];

    let launchTriggeredAtStep = -1;

    for (let step = 0; step < LAUNCH_PROFILE.length; step++) {
      const sample = LAUNCH_PROFILE[step];
      const isRunning = launchTriggeredAtStep !== -1;
      const result = processSensorMeasurement(state, sample, {
        isStaged: true,
        isRunning,
      });

      if (!isRunning && result.launchDetected) {
        launchTriggeredAtStep = step;
      }
    }

    // Step 2 has 3.8 m/s^2 (~0.39 G), which crosses the 0.25 G threshold
    assert.strictEqual(launchTriggeredAtStep, 2, 'Launch should be detected at step 2');
    // Peak G should reflect peak acceleration (~1.0G - 1.15G)
    assert.ok(state.peakG >= 0.7, `Peak G should be recorded: actual ${state.peakG.toFixed(2)}`);
  });

  it('rejects an isolated single-frame bump noise without triggering false launch', () => {
    const state = createSensorFusionState();

    // Calibrate
    for (const sample of RECORDED_RESTING_SAMPLES.slice(0, 20)) {
      processSensorMeasurement(state, sample, { isStaging: true });
    }

    // Single 1-frame bump (e.g. driver tapping dashboard: 2.0 m/s^2 for 1 frame)
    const bumpSample: Vec3 = { x: 0.05, y: 2.0, z: 0.05 };
    const result = processSensorMeasurement(state, bumpSample, {
      isStaged: true,
      isRunning: false,
      alpha: 0.2, // EMA filter
      launchThresholdG: 0.25,
    });

    // 2.0 m/s^2 is ~0.20 G raw, and filtered with alpha=0.2 from 0 gives 0.04 G
    assert.strictEqual(result.launchDetected, false, '1-frame bump must not trigger launch');
  });

  it('correctly projects forward acceleration along GPS course and device heading', () => {
    // Calibrated acceleration: car accelerates at 5.0 m/s^2 straight ahead
    // Device is mounted in portrait with heading = 90 deg (East), GPS course = 90 deg (East)
    const alignedAccel: Vec3 = { x: 0, y: 5.0, z: 0 };
    const forwardG = projectForwardG(alignedAccel, 90, 90);

    const expectedG = 5.0 / STANDARD_GRAVITY_MPS2;
    assert.ok(
      Math.abs(forwardG - expectedG) < 0.001,
      `Aligned forward G ${forwardG} should match expected ${expectedG}`,
    );
  });
});
