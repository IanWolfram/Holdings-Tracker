/**
 * In-memory sliding-window rate limiter.
 *
 * Valid because Pulse runs as a single long-lived Node process under pm2 (see
 * ecosystem.config.cjs) — one process, one shared Map. **If you ever run more
 * than one instance, this silently under-counts** (each process keeps its own
 * window); swap the store for Supabase/Redis behind the same `rateLimit()`
 * signature at that point.
 *
 * Keys are caller-supplied and should encode the scope, e.g.:
 *   rateLimit(`news:${user.id}`, NEWS_LIMIT)          // per-user
 *   rateLimit(`ip:${ip}:${route}`, IP_LIMIT)          // per-IP circuit breaker
 */

export interface RateLimitRule {
  /** Max requests allowed within the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Milliseconds until the caller may retry (0 when allowed). */
  retryAfterMs: number;
}

// key → ascending list of request timestamps (ms) still inside any window.
const hits = new Map<string, number[]>();

/**
 * Record a hit for `key` and report whether it is within `rule`. Sliding window:
 * counts timestamps in the trailing `windowMs`; the limit trips on the request
 * that would exceed `max` (that request is rejected and NOT counted).
 */
export function rateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const cutoff = now - rule.windowMs;
  const arr = hits.get(key);
  const recent = arr ? arr.filter((t) => t > cutoff) : [];

  if (recent.length >= rule.max) {
    // Oldest in-window hit determines when a slot frees up.
    const retryAfterMs = recent[0] + rule.windowMs - now;
    hits.set(key, recent); // keep pruned list; don't record the rejected hit
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: rule.max - recent.length, retryAfterMs: 0 };
}

// Periodic sweep so keys for idle users don't accumulate forever. The longest
// window we use is a few minutes; anything older than 10 min is safe to drop.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 10 * 60 * 1000;
const cleanup = setInterval(() => {
  const cutoff = Date.now() - STALE_AFTER_MS;
  for (const [key, arr] of hits) {
    const recent = arr.filter((t) => t > cutoff);
    if (recent.length === 0) hits.delete(key);
    else hits.set(key, recent);
  }
}, CLEANUP_INTERVAL_MS);
// Don't keep the event loop alive just for cleanup.
if (typeof cleanup.unref === "function") cleanup.unref();

// ── Tuned rules ────────────────────────────────────────────────────────────
// Values are generous on purpose: they must clear the dashboard's real fan-out
// (refresh every 30s → N news requests per held ticker, all at once, ×tabs) so
// real users never see a spurious 429. They exist to stop runaway loops and
// scripted abuse (thousands of distinct tickers), not to throttle normal use.

/** Per-user /api/news. 30-ticker user ×~2 refresh/min ×a few tabs ≈ 120–200/min. */
export const NEWS_LIMIT: RateLimitRule = { max: 600, windowMs: 60_000 };
/** Per-user /api/predictions — low fan-out (1–2/refresh). */
export const PREDICTIONS_LIMIT: RateLimitRule = { max: 120, windowMs: 60_000 };
/** Coarse per-IP circuit breaker for the whole API surface (anti-flood, not anti-attacker). */
export const IP_LIMIT: RateLimitRule = { max: 1200, windowMs: 60_000 };

/** Max tickers analyzed in a single sweep (caps DeepSeek/Polygon spend per run). */
export const SWEEP_MAX_TICKERS = 40;
