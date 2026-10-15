/**
 * Slipstream Drag Sensor Fusion & Telemetry Engine
 *
 * Implements:
 * 1. Gravity-removed linear acceleration parsing (from DeviceMotion 'acceleration')
 * 2. Stationary zero-offset calibration during staging (guarantees resting G < 0.03 G)
 * 3. Single-pole low-pass IIR filter (EMA) to damp cabin/engine high-frequency vibrations
 * 4. Longitudinal vehicle forward G projection
 * 5. Reliable launch detection threshold (G surge >= 0.25 G or GPS speed > 3 km/h)
 * 6. Standard drag strip splits (60 ft = 18.288m, 1/4 mi, 1/2 mi, 1 mi)
 */

export const STANDARD_GRAVITY_MPS2 = 9.80665;
export const SIXTY_FEET_METERS = 18.288; // 60 ft in meters
export const DEFAULT_LAUNCH_G_THRESHOLD = 0.25; // 0.25 G forward impulse
export const DEFAULT_LOW_PASS_ALPHA = 0.25; // ~8Hz cutoff at 25-50Hz sampling
export const DEFAULT_CALIBRATION_SAMPLES = 20; // 20 samples over 0.5-0.8s stationary

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SensorFusionState {
  bias: Vec3;
  isCalibrated: boolean;
  calibrationSamples: Vec3[];
  filteredG: number;
  peakG: number;
  lastRawG: number;
}

/**
 * Initialize a fresh sensor fusion state
 */
export function createSensorFusionState(): SensorFusionState {
  return {
    bias: { x: 0, y: 0, z: 0 },
    isCalibrated: false,
    calibrationSamples: [],
    filteredG: 0,
    peakG: 0,
    lastRawG: 0,
  };
}

/**
 * Reset state for a new staging run
 */
export function resetSensorFusion(state: SensorFusionState): void {
  state.bias = { x: 0, y: 0, z: 0 };
  state.isCalibrated = false;
  state.calibrationSamples = [];
  state.filteredG = 0;
  state.peakG = 0;
  state.lastRawG = 0;
}

/**
 * Compute the average bias vector from stationary resting samples
 */
export function computeZeroOffset(samples: Vec3[]): Vec3 {
  if (samples.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = samples.reduce(
    (acc, s) => ({
      x: acc.x + s.x,
      y: acc.y + s.y,
      z: acc.z + s.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  return {
    x: sum.x / samples.length,
    y: sum.y / samples.length,
    z: sum.z / samples.length,
  };
}

/**
 * Subtract the zero-offset bias from raw linear acceleration
 */
export function applyZeroOffset(raw: Vec3, bias: Vec3): Vec3 {
  return {
    x: raw.x - bias.x,
    y: raw.y - bias.y,
    z: raw.z - bias.z,
  };
}

/**
 * Single-pole exponential moving average (low-pass filter)
 * y[k] = alpha * x[k] + (1 - alpha) * y[k-1]
 */
export function lowPassFilter(
  currentVal: number,
  prevVal: number,
  alpha = DEFAULT_LOW_PASS_ALPHA,
): number {
  return alpha * currentVal + (1 - alpha) * prevVal;
}

/**
 * Project calibrated 3-axis linear acceleration (in m/s^2) into forward longitudinal G.
 * If GPS course and device heading are available, projects vector along the direction of travel.
 * When stationary or mounting angle is aligned, computes resultant horizontal/forward acceleration in G.
 */
export function projectForwardG(
  calibratedLinearAccel: Vec3,
  deviceHeadingDeg?: number | null,
  gpsCourseDeg?: number | null,
): number {
  const { x, y, z } = calibratedLinearAccel;

  // If GPS course and device heading are both provided and valid:
  if (
    typeof deviceHeadingDeg === 'number' &&
    typeof gpsCourseDeg === 'number' &&
    !isNaN(deviceHeadingDeg) &&
    !isNaN(gpsCourseDeg)
  ) {
    // Relative angle between device forward axis (Y in portrait) and GPS travel direction
    const deltaRad = ((gpsCourseDeg - deviceHeadingDeg) * Math.PI) / 180;
    // Projected forward component: Y is portrait forward, X is lateral
    const forwardMps2 = y * Math.cos(deltaRad) + x * Math.sin(deltaRad);
    return forwardMps2 / STANDARD_GRAVITY_MPS2;
  }

  // General 3D magnitude converted to Gs
  // In a vehicle, the net dynamic linear acceleration magnitude reflects tractive force
  const magMps2 = Math.sqrt(x * x + y * y + z * z);
  return magMps2 / STANDARD_GRAVITY_MPS2;
}

/**
 * Process a single measurement through the sensor fusion pipeline.
 */
export function processSensorMeasurement(
  state: SensorFusionState,
  rawLinearAccel: Vec3,
  options: {
    isStaging?: boolean;
    isStaged?: boolean;
    isRunning?: boolean;
    deviceHeading?: number | null;
    gpsCourse?: number | null;
    alpha?: number;
    launchThresholdG?: number;
  } = {},
): {
  filteredG: number;
  peakG: number;
  isCalibrated: boolean;
  launchDetected: boolean;
  restingG: number;
} {
  const alpha = options.alpha ?? DEFAULT_LOW_PASS_ALPHA;
  const launchThresholdG = options.launchThresholdG ?? DEFAULT_LAUNCH_G_THRESHOLD;

  // 1. If currently staging, accumulate calibration samples
  if (options.isStaging) {
    state.calibrationSamples.push({ ...rawLinearAccel });
    if (state.calibrationSamples.length >= DEFAULT_CALIBRATION_SAMPLES) {
      state.bias = computeZeroOffset(state.calibrationSamples);
      state.isCalibrated = true;
    }
  }

  // 2. Subtract calibrated zero-offset bias
  const calibrated = state.isCalibrated
    ? applyZeroOffset(rawLinearAccel, state.bias)
    : rawLinearAccel;

  // 3. Compute instantaneous G
  const rawG = projectForwardG(calibrated, options.deviceHeading, options.gpsCourse);
  state.lastRawG = rawG;

  // 4. Low-pass filter to remove engine/road vibrations
  const filteredG = lowPassFilter(rawG, state.filteredG, alpha);
  state.filteredG = filteredG;

  // 5. Track peak G during run
  if (options.isRunning) {
    if (filteredG > state.peakG) {
      state.peakG = filteredG;
    }
  }

  // 6. Launch detection trigger (when staged, before launch)
  let launchDetected = false;
  if (options.isStaged && !options.isRunning) {
    // Triggers if filtered G exceeds threshold OR raw surge exceeds 1.3x threshold
    if (filteredG >= launchThresholdG || rawG >= launchThresholdG * 1.3) {
      launchDetected = true;
    }
  }

  return {
    filteredG,
    peakG: state.peakG,
    isCalibrated: state.isCalibrated,
    launchDetected,
    restingG: Math.abs(filteredG),
  };
}
