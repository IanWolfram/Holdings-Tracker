/**
 * Polygon.io Utility for high-fidelity market data
 */

import { SLOW_API_TIMEOUT_MS } from "./constants";
import { debug } from "./debug";

// Free tier: 5 calls/minute = 1 per 12 s. Use 13 s to stay safely under.
// Override via POLYGON_RATE_MS env var on paid tiers.
let polygonQueue: Promise<void> = Promise.resolve();
let lastPolygonCallAt = 0;
const POLYGON_RATE_MS = Number(process.env.POLYGON_RATE_MS) || 13_000;

function enqueuePolygon<T>(fn: () => Promise<T>): Promise<T> {
  const result = polygonQueue.then(async () => {
    const wait = POLYGON_RATE_MS - (Date.now() - lastPolygonCallAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastPolygonCallAt = Date.now();
    return fn();
  });
  polygonQueue = result.then(() => {}, () => {});
  return result;
}

// AbortSignal is created fresh inside the queue so the 15s timeout only
// starts counting once the request is actually about to fire.
async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(SLOW_API_TIMEOUT_MS) });
    if (res.status !== 429) return res;
    const backoff = 15_000 * (attempt + 1);
    console.warn(`[polygon] 429 on attempt ${attempt + 1}, retrying in ${backoff / 1000}s`);
    await new Promise((r) => setTimeout(r, backoff));
  }
  throw new Error("Polygon HTTP 429 after retries");
}

export async function fetchCandlesPolygon(
  ticker: string,
  days: number = 90
): Promise<number[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.warn("[polygon] POLYGON_API_KEY not set");
    return [];
  }

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  const to = toDate.toISOString().split("T")[0];
  const from = fromDate.toISOString().split("T")[0];

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`;

  return enqueuePolygon(async () => {
    try {
      const res = await fetchWithRetry(url);
      if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);

      const data = await res.json();
      // Free tier returns "DELAYED" instead of "OK" — treat both as valid
      if ((data.status === "OK" || data.status === "DELAYED") && Array.isArray(data.results)) {
        debug("polygon", `Fetched ${data.results.length} candles for ${ticker} (${data.status})`);
        return data.results.map((r: { c: number }) => r.c);
      }

      console.warn(`[polygon] No results for ${ticker}:`, data.status);
      return [];
    } catch (err) {
      console.error(`[polygon] Error for ${ticker}:`, err);
      return [];
    }
  });
}

/**
 * Fetch news articles from Polygon.io for a given ticker.
 * Polygon's news coverage is broader than Finnhub for smaller-cap stocks.
 * An optional companyName enables tighter relevance pre-filtering.
 */
export async function fetchPolygonNews(ticker: string, companyName?: string): Promise<Array<{
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  source: "polygon";
}>> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) return [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const publishedGte = sevenDaysAgo.toISOString().split("T")[0];
  const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&published_utc.gte=${publishedGte}&limit=50&apiKey=${apiKey}`;

  return enqueuePolygon(async () => {
    try {
      const res = await fetchWithRetry(url);
      if (!res.ok) throw new Error(`Polygon news HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data.results)) return [];

      // Polygon's ticker filter is very loose — it returns articles that are
      // only tangentially tagged with the ticker.  Pre-filter at the source
      // level so we don't waste time classifying irrelevant stories.
      // (A thorough relevance check using the full company name happens in
      // NewsService after all sources are merged.)
      const tickerLc = ticker.toLowerCase();
      const nameTerms = companyName
        ? companyName.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
        : [];

      const isRelevant = (r: any) => {
        const text = `${r.title ?? ""} ${r.description ?? ""}`.toLowerCase();
        if (text.includes(tickerLc)) return true;
        return nameTerms.some(term => text.includes(term));
      };

      return data.results.filter(isRelevant).map((r: any) => ({
        headline: (r.title ?? "").trim(),
        summary: (r.description ?? "").trim(),
        url: (r.article_url ?? "").trim(),
        datetime: r.published_utc
          ? Math.floor(new Date(r.published_utc).getTime() / 1000)
          : 0,
        source: "polygon" as const,
      })).filter((s: { headline: string; summary: string; url: string; datetime: number; source: "polygon" }) => {
        if (!s.headline) { console.warn("[polygon] Skipping story with empty headline"); return false; }
        if (!s.url) { console.warn("[polygon] Skipping story with empty URL:", s.headline.slice(0, 60)); return false; }
        if (!Number.isFinite(s.datetime) || s.datetime <= 0) { console.warn("[polygon] Skipping story with invalid datetime:", s.headline.slice(0, 60)); return false; }
        return true;
      });
    } catch (err) {
      console.error(`[polygon] News fetch error for ${ticker}:`, err);
      return [];
    }
  });
}

export interface PolygonOHLCBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchOHLCPolygon(
  ticker: string,
  days: number = 730
): Promise<PolygonOHLCBar[]> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) throw new Error("POLYGON_API_KEY not set");

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);

  const to = toDate.toISOString().split("T")[0];
  const from = fromDate.toISOString().split("T")[0];

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;

  return enqueuePolygon(async () => {
    const res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`Polygon HTTP ${res.status}`);

    const data = (await res.json()) as {
      status?: string;
      results?: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
    };

    if (!(data.status === "OK" || data.status === "DELAYED") || !Array.isArray(data.results)) {
      throw new Error(`Polygon status ${data.status ?? "unknown"}`);
    }

    return data.results.map((r) => ({
      date: new Date(r.t).toISOString().slice(0, 10),
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v ?? 0,
    }));
  });
}
