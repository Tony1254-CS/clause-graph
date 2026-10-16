import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  assertRateLimit,
  getClientIp,
  resetRateLimits,
  RateLimitError,
} from "../rate-limit.server";

describe("Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests under the maximum limit", () => {
    const config = { maxRequests: 3, windowMs: 1000 };
    const key = "test:ip:1.2.3.4";

    const r1 = checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimit(key, config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimit(key, config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests that exceed the limit within window", () => {
    const config = { maxRequests: 2, windowMs: 1000 };
    const key = "test:ip:blocked";

    checkRateLimit(key, config);
    checkRateLimit(key, config);

    const r3 = checkRateLimit(key, config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.resetMs).toBeGreaterThan(0);

    expect(() => assertRateLimit(key, config, "login")).toThrow(RateLimitError);
  });

  it("resets capacity after sliding window expires", () => {
    const config = { maxRequests: 2, windowMs: 500 };
    const key = "test:ip:sliding";
    const t0 = 1000000;

    expect(checkRateLimit(key, config, t0).allowed).toBe(true);
    expect(checkRateLimit(key, config, t0 + 100).allowed).toBe(true);
    expect(checkRateLimit(key, config, t0 + 200).allowed).toBe(false);

    // After 600ms (window has elapsed)
    const tFuture = t0 + 600;
    const rFuture = checkRateLimit(key, config, tFuture);
    expect(rFuture.allowed).toBe(true);
  });

  it("maintains separate limits for different keys (IP / Org)", () => {
    const config = { maxRequests: 1, windowMs: 1000 };
    const keyA = "ip:192.168.1.1";
    const keyB = "ip:192.168.1.2";

    expect(checkRateLimit(keyA, config).allowed).toBe(true);
    expect(checkRateLimit(keyA, config).allowed).toBe(false);

    // keyB should be unaffected
    expect(checkRateLimit(keyB, config).allowed).toBe(true);
  });

  it("extracts client IP safely from multiple header formats", () => {
    const h1 = new Headers({ "x-forwarded-for": "203.0.113.195, 70.41.3.18" });
    expect(getClientIp(h1)).toBe("203.0.113.195");

    const h2 = new Headers({ "x-real-ip": "198.51.100.4" });
    expect(getClientIp(h2)).toBe("198.51.100.4");

    expect(getClientIp(null)).toBe("127.0.0.1");
  });
});
