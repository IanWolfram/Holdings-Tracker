/**
 * Application-wide constants and configuration values.
 */

// Timeouts and Intervals
export const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const NEWS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const ACCOUNT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// UI Configuration
export const NEWS_PREVIEW_COUNT = 3;

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
    : "https://etws.etrade.com";
