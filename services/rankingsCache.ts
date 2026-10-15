/**
 * Persistent Leaderboard Cache Service — Phase 7
 *
 * Saves last-known leaderboard datasets to AsyncStorage so the app
 * provides instantaneous loading and full offline support (e.g. in airplane mode).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CachedLeaderboard<T> {
  data: T[];
  cachedAt: number; // Unix timestamp in ms
}

const CACHE_PREFIX = '@slipstream/rankings:';

function buildKey(tab: string, period: string, scope: string, extra?: string): string {
  return `${CACHE_PREFIX}${tab}:${period}:${scope}:${extra ?? 'default'}`;
}

/**
 * Save leaderboard data to AsyncStorage.
 */
export async function saveLeaderboardToCache<T>(
  tab: string,
  period: string,
  scope: string,
  extra: string | undefined,
  data: T[],
): Promise<void> {
  try {
    const key = buildKey(tab, period, scope, extra);
    const entry: CachedLeaderboard<T> = {
      data,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    // Non-critical: failure to save to disk shouldn't block the app
    if (__DEV__) {
      console.warn('[RankingsCache] Failed to save cache:', err);
    }
  }
}

/**
 * Retrieve cached leaderboard data from AsyncStorage.
 */
export async function getLeaderboardFromCache<T>(
  tab: string,
  period: string,
  scope: string,
  extra?: string,
): Promise<CachedLeaderboard<T> | null> {
  try {
    const key = buildKey(tab, period, scope, extra);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLeaderboard<T>;
    if (parsed && Array.isArray(parsed.data)) {
      return parsed;
    }
    return null;
  } catch (err) {
    if (__DEV__) {
      console.warn('[RankingsCache] Failed to read cache:', err);
    }
    return null;
  }
}

/**
 * Format timestamp into human-readable relative time string:
 * e.g., "just now", "5 min ago", "2 hr ago", "yesterday"
 */
export function formatTimeAgo(timestampMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));

  if (diffSec < 60) {
    return 'just now';
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr} hr ago`;
  }
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
