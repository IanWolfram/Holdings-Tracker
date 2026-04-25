import { fetchStooqQuote } from "./stooq";
import {
  fetchYahooHistory,
  isYahooCrumbRateLimitedError,
} from "./yahoo-finance";
import { fetchCandlesPolygon } from "./polygon";
import { NEWS_CACHE_TTL_MS, ACCOUNT_CACHE_TTL_MS } from "./constants";
import type { QuoteData, HistoryData } from "@/types/market-data.types";

const quoteCache = new Map<string, { data: QuoteData; expiresAt: number }>();
const historyCache = new Map<string, { data: HistoryData; expiresAt: number }>();
const polygonInflight = new Map<string, Promise<HistoryData | null>>();
const YAHOO_RATE_LIMIT_LOG_COOLDOWN_MS = 5 * 60 * 1000;
let yahooRateLimitLoggedUntil = 0;
// Short budget for the request-path await on Polygon. If the rate-limit queue
// is backed up, we return null now and let the fetch continue in the background;
// the next 5-min SWR poll will pick up the warmed cache.
const POLYGON_REQUEST_BUDGET_MS = 2_500;

export async function getQuote(ticker: string): Promise<QuoteData | null> {
  const cached = quoteCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Primary: Stooq (no API key required)
  try {
    const data = await fetchStooqQuote(ticker);
    quoteCache.set(ticker, { data, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
    return data;
  } catch (err) {
    console.warn(
      `[market-data] Stooq failed for ${ticker}:`,
      (err as Error).message
    );
  }

  // Fallback: Finnhub quote endpoint (if API key is configured)
  const apiKey = process.env.FINNHUB_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${apiKey}`,
        {
          signal: AbortSignal.timeout(10_000),
        }
      );
      if (res.ok) {
        const json = (await res.json()) as {
          c: number;
          h: number;
          l: number;
          pc: number;
          dp: number;
        };
        if (json.c) {
          const data: QuoteData = {
            ticker,
            currentPrice: json.c,
            changePercent: json.dp,
            dayHigh: json.h,
            dayLow: json.l,
            previousClose: json.pc,
            source: "finnhub",
            fetchedAt: Date.now(),
          };
          quoteCache.set(ticker, {
            data,
            expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
          });
          return data;
        }
      }
    } catch (err) {
      console.warn(
        `[market-data] Finnhub fallback failed for ${ticker}:`,
        (err as Error).message
      );
    }
  }

  return null;
}

export interface GetHistoryOptions {
  /**
   * When true, await the full Polygon fallback instead of racing against the
   * request-path budget. Use for background cron/CLI callers that need the
   * cache fully warmed before they return.
   */
  awaitPolygon?: boolean;
}

export async function getHistory(
  ticker: string,
  opts: GetHistoryOptions = {}
): Promise<HistoryData | null> {
  const cached = historyCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Primary: Yahoo Finance for fast, parallel history fetches.
  try {
    const data = await fetchYahooHistory(ticker);
    historyCache.set(ticker, {
      data,
      expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
    });
    return data;
  } catch (err) {
    if (isYahooCrumbRateLimitedError(err)) {
      const now = Date.now();
      if (now >= yahooRateLimitLoggedUntil) {
        console.warn(
          "[market-data] Yahoo crumb is rate-limited; falling back to Polygon (background fetch, cache warms for next poll)."
        );
        yahooRateLimitLoggedUntil = now + YAHOO_RATE_LIMIT_LOG_COOLDOWN_MS;
      }
    } else {
      console.warn(
        `[market-data] Yahoo history failed for ${ticker}:`,
        (err as Error).message
      );
    }
  }

  // Fallback: Polygon.io (requires POLYGON_API_KEY). Polygon's free tier
  // serializes to ~1 call per 12s, so request-path callers race against
  // a short budget and let the fetch continue in the background; the next
  // SWR poll picks up the warmed cache. Background callers pass
  // awaitPolygon=true to wait for the fetch and populate the cache inline.
  const promise = startPolygonFetch(ticker);
  if (opts.awaitPolygon) return promise;

  return Promise.race<HistoryData | null>([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), POLYGON_REQUEST_BUDGET_MS)
    ),
  ]);
}

function startPolygonFetch(ticker: string): Promise<HistoryData | null> {
  const existing = polygonInflight.get(ticker);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const closes = await fetchCandlesPolygon(ticker, 90);
      if (closes.length > 0) {
        const data: HistoryData = {
          ticker,
          closes,
          source: "polygon",
          fetchedAt: Date.now(),
        };
        historyCache.set(ticker, {
          data,
          expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
        });
        return data;
      }
      return null;
    } catch (err) {
      console.warn(
        `[market-data] Polygon history failed for ${ticker}:`,
        (err as Error).message
      );
      return null;
    } finally {
      polygonInflight.delete(ticker);
    }
  })();

  polygonInflight.set(ticker, promise);
  return promise;
}

export async function getQuotes(
  tickers: string[]
): Promise<Record<string, QuoteData>> {
  const results = await Promise.allSettled(tickers.map((t) => getQuote(t)));
  const out: Record<string, QuoteData> = {};
  tickers.forEach((ticker, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && r.value !== null) {
      out[ticker] = r.value;
    }
  });
  return out;
}
