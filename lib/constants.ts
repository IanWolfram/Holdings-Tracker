/**
 * Application-wide constants and configuration values.
 */

import path from "path";

// Timeouts and Intervals
export const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds
export const NEWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const ACCOUNT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const WORLD_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const WORLD_VAULT_PATH = process.env.WORLD_VAULT_PATH ?? null;

export function resolveVaultPath(vaultPath: string | null | undefined): string | null {
  if (!vaultPath) return null;
  const basePath = process.env.PULSE_USER_DATA_PATH ?? process.cwd();
  return vaultPath.startsWith(".") ? path.join(basePath, vaultPath) : vaultPath;
}


// UI Configuration
export const NEWS_PREVIEW_COUNT = 3;

// Duplicate / same-event story detection
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.55;
export const DUPLICATE_MIN_TOKENS = 4;

// Animation & Physics
export const GLASS_SPRING_CONFIG = {
  stiffness: 100,
  damping: 20,
};

// E*Trade API Environments
export const ETRADE_BASE_URL =
  process.env.ETRADE_ENV === "sandbox"
    ? "https://apisb.etrade.com"
    : "https://api.etrade.com";

export const ETRADE_AUTH_BASE_URL =
  process.env.ETRADE_ENV === "sandbox"
    ? "https://apisb.etrade.com"
    : "https://api.etrade.com";
