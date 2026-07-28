/**
 * Application-wide constants and configuration values.
 */

import path from "path";

// ── Timeouts and Intervals ──────────────────────────────────────────────────

export const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
export const NEWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const ACCOUNT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WORLD_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const WORLD_VAULT_PATH = process.env.WORLD_VAULT_PATH ?? null;

/** System user ID for vault writes when no user session exists (CLI/cron). */
export const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000000";

export function resolveVaultPath(vaultPath: string | null | undefined): string | null {
  if (!vaultPath) return null;
  const basePath = process.env.PULSE_USER_DATA_PATH ?? process.cwd();
  return vaultPath.startsWith(".") ? path.join(basePath, vaultPath) : vaultPath;
}

// ── HTTP Timeouts ───────────────────────────────────────────────────────────

/** Standard timeout for most external API calls (Finnhub, Stooq, etc.) */
export const API_TIMEOUT_MS = 10_000;

/** Extended timeout for rate-limited or heavy endpoints (Polygon, Jina) */
export const SLOW_API_TIMEOUT_MS = 15_000;

// ── External API Base URLs ──────────────────────────────────────────────────

export const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export const PARQET_LOGO_BASE_URL = "https://assets.parqet.com/logos/symbol";

// ── Classification / Verdict Thresholds ─────────────────────────────────────

/** Net-score threshold above which the verdict flips from HOLD to BUY or SELL. */
export const VERDICT_THRESHOLD = 0.15;

/** Default confidence when no analysis or classification is available. */
export const FALLBACK_CONFIDENCE = 0.5;

/** Maximum content characters sent to the AI for article analysis. */
export const MAX_ARTICLE_CONTENT_CHARS = 6000;

// Duplicate / same-event story detection
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.55;
export const DUPLICATE_MIN_TOKENS = 4;