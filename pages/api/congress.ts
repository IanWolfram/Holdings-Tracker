import type { NextApiResponse } from "next";
import { getHotTrades, getRecentHotTrades } from "@/lib/insiders";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import type { CongressTrade } from "@/types/news.types";
import { apiHandler } from "@/lib/api-handler";

interface CongressResponse {
  trades: CongressTrade[];
  fetchedAt: number;
}

// Short server-side cache keyed by (user, requested tickers). The read path is a
// fast DB query now (excess-return is precomputed off-request), but the dashboard
// polls this from several hooks — caching collapses overlapping polls into one
// query instead of stacking work. Bounded so it can't grow without limit across
// many users / ticker sets.
const RESPONSE_CACHE_TTL_MS = 60_000;
const RESPONSE_CACHE_MAX = 500;
const responseCache = new Map<string, { at: number; payload: CongressResponse }>();

export default apiHandler(["GET"], async (req, res: NextApiResponse<CongressResponse | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const requested =
      typeof req.query.tickers === "string"
        ? req.query.tickers.split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
        : [];

    const cacheKey = `${user.id}|${[...requested].sort().join(",")}`;
    const now = Date.now();
    const hit = responseCache.get(cacheKey);
    if (hit && now - hit.at < RESPONSE_CACHE_TTL_MS) {
      return res.status(200).json(hit.payload);
    }

    let trades: CongressTrade[];
    if (requested.length > 0) {
      // Ticker-scoped read (dashboard / watchlist): union the explicitly
      // requested tickers with the user's holdings, de-duped.
      const { portfolioService } = await getServicesForUser(user.id);
      const { positions } = await portfolioService.getPositionsSafe();
      const heldTickers = positions.map(p => p.ticker.toUpperCase());
      const tickers = [...new Set([...heldTickers, ...requested])];
      trades = await getHotTrades(tickers);
    } else {
      // No tickers requested → general discovery feed (Hot tab, nav badge).
      // Holdings-scoping here would silently empty the feed whenever a
      // portfolio doesn't overlap recent filings, so we serve recent activity
      // across all tickers instead.
      trades = await getRecentHotTrades();
    }

    const payload: CongressResponse = { trades, fetchedAt: Date.now() };
    if (responseCache.size >= RESPONSE_CACHE_MAX) {
      // Cheap eviction: drop the oldest entry by insertion order.
      const oldest = responseCache.keys().next().value;
      if (oldest !== undefined) responseCache.delete(oldest);
    }
    responseCache.set(cacheKey, { at: now, payload });
    res.status(200).json(payload);
  } catch (err) {
    console.error("[api/congress]", err);
    res.status(500).json({ error: "Failed to fetch hot trades data" });
  }
}, "api/congress");
