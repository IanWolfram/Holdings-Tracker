import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to max requests in a window and rejects the overflow uncounted", () => {
    const rule = { max: 3, windowMs: 60_000 };
    const key = `t1:${Math.random()}`;

    expect(rateLimit(key, rule)).toMatchObject({ allowed: true, remaining: 2 });
    expect(rateLimit(key, rule)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rateLimit(key, rule)).toMatchObject({ allowed: true, remaining: 0 });

    const rejected = rateLimit(key, rule);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterMs).toBeGreaterThan(0);
    expect(rejected.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("frees a slot once the oldest hit leaves the sliding window", () => {
    const rule = { max: 2, windowMs: 60_000 };
    const key = `t2:${Math.random()}`;

    rateLimit(key, rule);
    vi.advanceTimersByTime(30_000);
    rateLimit(key, rule);
    expect(rateLimit(key, rule).allowed).toBe(false);

    // 31s later the first hit (t=0) is outside the 60s window; the second (t=30s) is not.
    vi.advanceTimersByTime(31_000);
    expect(rateLimit(key, rule).allowed).toBe(true);
    expect(rateLimit(key, rule).allowed).toBe(false);
  });

  it("keeps independent windows per key", () => {
    const rule = { max: 1, windowMs: 60_000 };
    const a = `t3a:${Math.random()}`;
    const b = `t3b:${Math.random()}`;
    expect(rateLimit(a, rule).allowed).toBe(true);
    expect(rateLimit(b, rule).allowed).toBe(true);
    expect(rateLimit(a, rule).allowed).toBe(false);
  });

  it("a rejected request does not extend the lockout (rejections are not counted)", () => {
    const rule = { max: 1, windowMs: 10_000 };
    const key = `t4:${Math.random()}`;
    rateLimit(key, rule);
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(1_000);
      expect(rateLimit(key, rule).allowed).toBe(false);
    }
    vi.advanceTimersByTime(5_001); // 10s after the single counted hit
    expect(rateLimit(key, rule).allowed).toBe(true);
  });
});
