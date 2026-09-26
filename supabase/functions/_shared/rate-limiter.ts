/**
 * Upstash Redis Rate Limiter for Supabase Edge Functions
 *
 * Uses Upstash REST API for distributed atomic rate limiting across edge instances.
 * Falls back gracefully to in-memory sliding window if Upstash credentials are not configured.
 */

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// In-memory fallback bucket
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const upstashUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const upstashToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

  const now = Math.floor(Date.now() / 1000);
  const key = `ratelimit:${identifier}:${Math.floor(now / windowSeconds)}`;

  if (upstashUrl && upstashToken) {
    try {
      // INCR and EXPIRE pipeline via Upstash REST
      const res = await fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', key],
          ['EXPIRE', key, windowSeconds * 2],
        ]),
      });

      if (res.ok) {
        const data = await res.json();
        const count = Number(data[0]?.result ?? 1);
        const remaining = Math.max(0, limit - count);
        const reset = (Math.floor(now / windowSeconds) + 1) * windowSeconds;

        return {
          success: count <= limit,
          limit,
          remaining,
          reset,
        };
      }
    } catch (err) {
      console.warn('[RateLimiter] Upstash Redis call failed, falling back to local memory:', err);
    }
  }

  // Fallback: In-memory sliding window
  const bucket = memoryBuckets.get(identifier);
  if (!bucket || bucket.resetAt <= now) {
    memoryBuckets.set(identifier, { count: 1, resetAt: now + windowSeconds });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: now + windowSeconds,
    };
  }

  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return {
    success: bucket.count <= limit,
    limit,
    remaining,
    reset: bucket.resetAt,
  };
}
