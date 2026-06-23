/**
 * Request-coalescing client for `/api/congress`.
 *
 * Several hooks poll congress data independently (the Hot tab feed, the nav
 * badge, and per-ticker dashboard reads). Left alone they fire overlapping
 * requests for the same URL on the same interval. This helper dedupes by URL:
 * concurrent callers share one in-flight promise, and a short TTL serves the
 * last result so a 60s-interval trio collapses to a single network call.
 */
import { authedFetch } from "@/lib/api/client-fetch";
import type { CongressTrade } from "@/types/news.types";

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; promise: Promise<CongressTrade[]> }>();

/**
 * Fetch congressional trades. Pass an explicit ticker list for a scoped read, or
 * nothing for the general recent feed. Never rejects — failures resolve to [].
 */
export function fetchCongressTrades(tickers?: string[]): Promise<CongressTrade[]> {
  const upper = (tickers ?? []).map((t) => t.toUpperCase()).filter(Boolean);
  const key = upper.length ? [...new Set(upper)].sort().join(",") : "__recent__";
  const now = Date.now();

  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.promise;

  const url =
    key === "__recent__"
      ? "/api/congress"
      : `/api/congress?tickers=${encodeURIComponent(key)}`;

  const promise = (async () => {
    const res = await authedFetch(url);
    if (!res.ok) return [];
    const { trades } = (await res.json()) as { trades: CongressTrade[] };
    return trades;
  })().catch(() => {
    // Drop the failed entry so the next poll retries instead of caching [].
    cache.delete(key);
    return [] as CongressTrade[];
  });

  cache.set(key, { at: now, promise });
  return promise;
}
