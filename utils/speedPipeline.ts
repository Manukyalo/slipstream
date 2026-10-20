/**
 * Speed and Distance Pipeline
 *
 * Implements strict telemetry filtering rules:
 * - Doppler speed only (coords.speed in m/s). Never derive from distance.
 * - Accept fix only if accuracy <= 25 m. Treat worse as "weak".
 * - Unlock speed display only after 3 consecutive good fixes; otherwise 'acquiring' / dash.
 * - Stationary clamp: if filtered speed < 2.0 m/s (~7.2 km/h) for the last 3 fixes
 *   or accelerometer variance is near zero (< 0.005 g^2), force speed to 0.
 * - Light smoothing (EMA alpha=0.35) with short debounce for transient spike rejection.
 * - Distance accumulation only when displacement > max(10m, fix.accuracy) AND speed is above clamp.
 */

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

export const GPS_ACCURACY_THRESHOLD_M = 25; // Accept fix only if <= 25m
export const GPS_EXCELLENT_ACCURACY_M = 10; // <= 10m is "Good"
export const STATIONARY_SPEED_CLAMP_MS = 2.0; // 2.0 m/s (~7.2 km/h)
export const REQUIRED_CONSECUTIVE_FIXES = 3; // 3 consecutive good fixes before showing speed
export const ACCELEROMETER_STATIONARY_VAR_THRESHOLD = 0.005; // g^2

export type GpsQuality = 'acquiring' | 'good' | 'weak';

export interface RawGpsFix {
  latitude: number;
  longitude: number;
  speed: number | null; // m/s Doppler
  accuracy: number | null; // meters
  timestamp: number; // epoch ms
  heading?: number | null;
}

export interface SpeedPipelineOutput {
  /** Speed to display in km/h. null means "Acquiring" / dash ('—') */
  displaySpeedKmh: number | null;
  /** Raw Doppler speed converted to km/h */
  rawSpeedKmh: number;
  /** Filtered speed in km/h */
  filteredSpeedKmh: number;
  /** Filtered speed in m/s */
  filteredSpeedMs: number;
  /** Current GPS quality status */
  quality: GpsQuality;
  /** True if stationary clamp is active (speed forced to 0) */
  isStationary: boolean;
  /** Number of consecutive valid fixes under threshold */
  consecutiveGoodFixes: number;
  /** Distance added by this fix (meters) */
  distanceIncrementMeters: number;
  /** Total cumulative distance (meters) */
  totalDistanceMeters: number;
  /** Session top speed (km/h) */
  topSpeedKmh: number;
  /** Accuracy of last fix in meters */
  accuracy: number | null;
  /** Timestamp of last fix */
  timestamp: number;
}

export class SpeedPipeline {
  private consecutiveGoodFixes = 0;
  private filteredSpeedMs = 0;
  private recentFilteredSpeedsMs: number[] = [];
  private lastGoodPosition: { latitude: number; longitude: number } | null = null;
  private totalDistanceMeters = 0;
  private topSpeedKmh = 0;
  private isStationary = true;
  private lastFixTimestamp = 0;

  // Smoothing constant for Exponential Moving Average (EMA)
  private readonly emaAlpha = 0.35;

  /**
   * Process a single incoming GPS fix and optional accelerometer variance.
   */
  public processFix(fix: RawGpsFix, accelVariance?: number): SpeedPipelineOutput {
    this.lastFixTimestamp = fix.timestamp;
    const accuracy = fix.accuracy;

    // 1. Accuracy Check: fix is good only if accuracy is known and <= 25m
    const isGoodFix = accuracy !== null && accuracy !== undefined && accuracy > 0 && accuracy <= GPS_ACCURACY_THRESHOLD_M;

    if (!isGoodFix) {
      this.consecutiveGoodFixes = 0;
      this.recentFilteredSpeedsMs = [];
      const quality: GpsQuality = (accuracy !== null && accuracy !== undefined && accuracy > GPS_ACCURACY_THRESHOLD_M)
        ? 'weak'
        : 'acquiring';

      return {
        displaySpeedKmh: null,
        rawSpeedKmh: 0,
        filteredSpeedKmh: 0,
        filteredSpeedMs: 0,
        quality,
        isStationary: true,
        consecutiveGoodFixes: 0,
        distanceIncrementMeters: 0,
        totalDistanceMeters: Number(this.totalDistanceMeters.toFixed(1)),
        topSpeedKmh: Number(this.topSpeedKmh.toFixed(1)),
        accuracy: accuracy ?? null,
        timestamp: fix.timestamp,
      };
    }

    // Fix is good!
    this.consecutiveGoodFixes += 1;
    const quality: GpsQuality = accuracy <= GPS_EXCELLENT_ACCURACY_M ? 'good' : 'weak';

    // 2. Doppler Speed (coords.speed, m/s only)
    // Ignore null or negative speed
    const rawDopplerMs = fix.speed !== null && fix.speed !== undefined && fix.speed >= 0 ? fix.speed : 0;
    const rawSpeedKmh = rawDopplerMs * 3.6;

    // 3. Light EMA Filter & Debounce
    if (this.consecutiveGoodFixes === 1) {
      this.filteredSpeedMs = rawDopplerMs;
    } else {
      // Debounce large transient spikes (> 5.0 m/s jump in 1 fix)
      const diff = rawDopplerMs - this.filteredSpeedMs;
      const rateLimitedDoppler = Math.abs(diff) > 5.0
        ? this.filteredSpeedMs + Math.sign(diff) * 5.0
        : rawDopplerMs;

      this.filteredSpeedMs = this.emaAlpha * rateLimitedDoppler + (1 - this.emaAlpha) * this.filteredSpeedMs;
    }

    // Keep sliding window of last 3 filtered speeds
    this.recentFilteredSpeedsMs.push(this.filteredSpeedMs);
    if (this.recentFilteredSpeedsMs.length > REQUIRED_CONSECUTIVE_FIXES) {
      this.recentFilteredSpeedsMs.shift();
    }

    // 4. Check if 3 consecutive good fixes have arrived
    if (this.consecutiveGoodFixes < REQUIRED_CONSECUTIVE_FIXES) {
      // Still acquiring — display dash
      return {
        displaySpeedKmh: null,
        rawSpeedKmh: Number(rawSpeedKmh.toFixed(1)),
        filteredSpeedKmh: Number((this.filteredSpeedMs * 3.6).toFixed(1)),
        filteredSpeedMs: Number(this.filteredSpeedMs.toFixed(2)),
        quality: 'acquiring',
        isStationary: true,
        consecutiveGoodFixes: this.consecutiveGoodFixes,
        distanceIncrementMeters: 0,
        totalDistanceMeters: Number(this.totalDistanceMeters.toFixed(1)),
        topSpeedKmh: Number(this.topSpeedKmh.toFixed(1)),
        accuracy,
        timestamp: fix.timestamp,
      };
    }

    // 5. Stationary Clamp:
    // If filtered speed < 2.0 m/s (~7.2 km/h) for the last 3 good fixes,
    // OR accelerometer variance is near zero, force speed to 0.
    const isBelowClampThreshold =
      this.recentFilteredSpeedsMs.length >= REQUIRED_CONSECUTIVE_FIXES &&
      this.recentFilteredSpeedsMs.every((s) => s < STATIONARY_SPEED_CLAMP_MS);

    const isAccelStill =
      accelVariance !== undefined &&
      accelVariance >= 0 &&
      accelVariance < ACCELEROMETER_STATIONARY_VAR_THRESHOLD;

    if (isBelowClampThreshold || isAccelStill) {
      this.isStationary = true;
      this.filteredSpeedMs = 0;
    } else {
      this.isStationary = false;
    }

    const effectiveSpeedMs = this.isStationary ? 0 : this.filteredSpeedMs;
    const effectiveSpeedKmh = effectiveSpeedMs * 3.6;
    const displaySpeedKmh = Math.round(effectiveSpeedKmh);

    // Update session top speed (only when not stationary and display > 0)
    if (!this.isStationary && displaySpeedKmh > this.topSpeedKmh) {
      this.topSpeedKmh = displaySpeedKmh;
    }

    // 6. Distance Accumulation:
    // Count distance only when displacement between good fixes is > max(10 m, fix accuracy)
    // AND speed is above the stationary clamp.
    let distanceIncrementMeters = 0;

    if (this.lastGoodPosition) {
      const displacement = calculateDistanceMeters(
        this.lastGoodPosition.latitude,
        this.lastGoodPosition.longitude,
        fix.latitude,
        fix.longitude,
      );

      const minDisplacement = Math.max(10, accuracy);

      if (displacement > minDisplacement && !this.isStationary && effectiveSpeedMs >= STATIONARY_SPEED_CLAMP_MS) {
        distanceIncrementMeters = displacement;
        this.totalDistanceMeters += displacement;
        this.lastGoodPosition = { latitude: fix.latitude, longitude: fix.longitude };
      }
    } else {
      // Initial anchor position
      this.lastGoodPosition = { latitude: fix.latitude, longitude: fix.longitude };
    }

    return {
      displaySpeedKmh,
      rawSpeedKmh: Number(rawSpeedKmh.toFixed(1)),
      filteredSpeedKmh: Number(effectiveSpeedKmh.toFixed(1)),
      filteredSpeedMs: Number(effectiveSpeedMs.toFixed(2)),
      quality,
      isStationary: this.isStationary,
      consecutiveGoodFixes: this.consecutiveGoodFixes,
      distanceIncrementMeters: Number(distanceIncrementMeters.toFixed(1)),
      totalDistanceMeters: Number(this.totalDistanceMeters.toFixed(1)),
      topSpeedKmh: Number(this.topSpeedKmh.toFixed(1)),
      accuracy,
      timestamp: fix.timestamp,
    };
  }

  /**
   * Reset all pipeline metrics back to idle/zero.
   */
  public reset(): void {
    this.consecutiveGoodFixes = 0;
    this.filteredSpeedMs = 0;
    this.recentFilteredSpeedsMs = [];
    this.lastGoodPosition = null;
    this.totalDistanceMeters = 0;
    this.topSpeedKmh = 0;
    this.isStationary = true;
    this.lastFixTimestamp = 0;
  }

  public getStatus(): {
    consecutiveGoodFixes: number;
    totalDistanceMeters: number;
    topSpeedKmh: number;
    lastFixTimestamp: number;
  } {
    return {
      consecutiveGoodFixes: this.consecutiveGoodFixes,
      totalDistanceMeters: this.totalDistanceMeters,
      topSpeedKmh: this.topSpeedKmh,
      lastFixTimestamp: this.lastFixTimestamp,
    };
  }
}
