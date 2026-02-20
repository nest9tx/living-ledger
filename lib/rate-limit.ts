/**
 * Simple in-memory rate limiter for MVP stage.
 * For production at scale, replace this Map with a Redis-backed store
 * (e.g. @upstash/ratelimit) to share state across serverless instances.
 */

const store = new Map<string, { count: number; resetAt: number }>();

// Prune expired entries every minute to prevent unbounded memory growth
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (val.resetAt < now) store.delete(key);
    }
  }, 60_000);
}

/**
 * Check whether a request should be allowed.
 *
 * @param identifier - Unique key per actor (e.g. `userId` or IP address)
 * @param limit      - Maximum requests allowed within the window
 * @param windowMs   - Rolling window length in milliseconds
 *
 * @returns `success: true` if the request is within limits, `false` if it exceeds them.
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = store.get(identifier);

  if (!record || record.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(identifier, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { success: true, remaining: limit - record.count, resetAt: record.resetAt };
}
