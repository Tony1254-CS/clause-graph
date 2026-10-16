/**
 * In-memory sliding-window token bucket rate limiter for auth and AI endpoints.
 * Provides high-throughput protection with per-IP and per-organization tracking.
 */

export class RateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterSeconds: number;
  readonly limit: number;
  readonly remaining: number;

  constructor(message: string, retryAfterSeconds: number, limit: number, remaining: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.limit = limit;
    this.remaining = remaining;
  }
}

type BucketEntry = {
  timestamps: number[];
};

// Global in-memory bucket store
const buckets = new Map<string, BucketEntry>();

export type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 per minute per IP
};

export const AI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60 * 60 * 1000, // 30 per hour per Org
};

/**
 * Check and record a rate-limit event for a given identifier key.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
  now = Date.now(),
): {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
} {
  const windowStart = now - config.windowMs;
  let entry = buckets.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }

  // Filter timestamps within current sliding window
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  const currentCount = entry.timestamps.length;
  const allowed = currentCount < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0));

  const oldestTimestamp = entry.timestamps[0] ?? now;
  const resetMs = Math.max(0, oldestTimestamp + config.windowMs - now);

  if (allowed) {
    entry.timestamps.push(now);
  }

  return {
    allowed,
    remaining,
    resetMs,
    limit: config.maxRequests,
  };
}

/**
 * Enforce rate limit, throwing RateLimitError (HTTP 429) if exceeded.
 */
export function assertRateLimit(
  key: string,
  config: RateLimitConfig,
  actionName = "requests",
): void {
  const res = checkRateLimit(key, config);
  if (!res.allowed) {
    const retrySec = Math.ceil(res.resetMs / 1000) || 1;
    throw new RateLimitError(
      `Rate limit exceeded for ${actionName}. Allowed: ${config.maxRequests} per ${Math.round(
        config.windowMs / 1000,
      )}s. Please retry in ${retrySec} seconds.`,
      retrySec,
      config.maxRequests,
      res.remaining,
    );
  }
}

/**
 * Extract client IP address safely from Request or Headers.
 */
export function getClientIp(
  headers?: Headers | Record<string, string | string[] | undefined> | null,
): string {
  if (!headers) return "127.0.0.1";

  if (typeof (headers as Headers).get === "function") {
    const h = headers as Headers;
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  } else {
    const raw = headers as Record<string, string | string[] | undefined>;
    const fwd = raw["x-forwarded-for"];
    if (typeof fwd === "string") return fwd.split(",")[0].trim();
    if (Array.isArray(fwd) && fwd[0]) return fwd[0].split(",")[0].trim();
    const real = raw["x-real-ip"];
    if (typeof real === "string") return real.trim();
    if (Array.isArray(real) && real[0]) return real[0].trim();
  }

  return "127.0.0.1";
}

/**
 * Reset all or a specific rate limit bucket (useful for testing).
 */
export function resetRateLimits(keyPrefix?: string): void {
  if (!keyPrefix) {
    buckets.clear();
  } else {
    for (const k of Array.from(buckets.keys())) {
      if (k.startsWith(keyPrefix)) {
        buckets.delete(k);
      }
    }
  }
}
