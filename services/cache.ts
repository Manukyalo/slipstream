/**
 * Distributed & In-Memory Cache Service
 *
 * Implements a 2-tier caching pattern:
 * - L1: Fast in-process memory cache for immediate sub-millisecond responses
 * - L2: Upstash Redis REST API for shared edge caching with TTL
 *
 * Designed to gracefully fall back to L1 and direct DB fetching if Upstash
 * credentials are missing or unreachable.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in ms
}

// L1 In-memory store
const memoryCache = new Map<string, CacheEntry<unknown>>();

const UPSTASH_URL = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN;

/**
 * Retrieve a cached value by key. Checks L1 memory first, then L2 Upstash Redis.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();

  // 1. Check L1 Memory Cache
  const memoryHit = memoryCache.get(key);
  if (memoryHit && memoryHit.expiresAt > now) {
    return memoryHit.value as T;
  }
  if (memoryHit && memoryHit.expiresAt <= now) {
    memoryCache.delete(key);
  }

  // 2. Check L2 Upstash Redis (if configured)
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        if (json.result !== null && json.result !== undefined) {
          const parsed = typeof json.result === 'string' ? JSON.parse(json.result) : json.result;
          // Hydrate L1 memory cache with a remaining TTL of 30 seconds
          memoryCache.set(key, { value: parsed, expiresAt: now + 30_000 });
          return parsed as T;
        }
      }
    } catch (err) {
      // Fail open: log and proceed without cache
      console.warn(`[Cache] Redis GET failed for "${key}":`, err);
    }
  }

  return null;
}

/**
 * Store a value in L1 memory and L2 Upstash Redis with a TTL in seconds.
 */
export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;

  // 1. Save to L1 Memory
  memoryCache.set(key, { value, expiresAt });

  // 2. Save to L2 Upstash Redis (if configured)
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const serialized = JSON.stringify(value);
      await fetch(
        `${UPSTASH_URL}/set/${encodeURIComponent(key)}?ex=${ttlSeconds}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${UPSTASH_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(serialized),
        },
      );
    } catch (err) {
      console.warn(`[Cache] Redis SET failed for "${key}":`, err);
    }
  }
}

/**
 * Cache-aside wrapper: Returns cached value if available; otherwise invokes fetcher,
 * caches the result with the specified TTL, and returns it.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fetcher();
  // Don't block the caller on remote Redis write
  cacheSet(key, fresh, ttlSeconds).catch(() => {});
  return fresh;
}
