import { fetchCandlesPolygon } from "./polygon";
import { NEWS_CACHE_TTL_MS, ACCOUNT_CACHE_TTL_MS, FINNHUB_BASE_URL, API_TIMEOUT_MS } from "./constants";
import type { QuoteData, HistoryData } from "@/types/market-data.types";

const quoteCache = new Map<string, { data: QuoteData; expiresAt: number }>();
const historyCache = new Map<string, { data: HistoryData; expiresAt: number }>();
const polygonInflight = new Map<string, Promise<HistoryData | null>>();
// Short budget for the request-path await on Polygon. If the rate-limit queue
// is backed up, we return null now and let the fetch continue in the background;
// the next 5-min SWR poll will pick up the warmed cache.
const POLYGON_REQUEST_BUDGET_MS = 2_500;

export async function getBasicQuote(ticker: string): Promise<QuoteData | null> {
  const cached = quoteCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Primary: Finnhub quote endpoint (60 calls/min free tier). Stooq used to be
  // the keyless primary here but its CSV endpoint was removed (404s for every
  // symbol as of 2026-07).
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const res = await fetch(
        `${FINNHUB_BASE_URL}/quote?symbol=${ticker}&token=${finnhubKey}`,
        {
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
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
        `[market-data] Finnhub quote failed for ${ticker}:`,
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

  // Primary: Finnhub (60 calls/min, no daily cap)
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (finnhubKey) {
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - 760 * 86_400; // ~2 years of calendar days (~520 trading days)
      const url =
        `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(ticker)}` +
        `&resolution=D&from=${from}&to=${to}&token=${finnhubKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
      if (res.ok) {
        const json = (await res.json()) as {
          s?: string;
          t?: number[];
          c?: number[];
        };
        if (json.s === "ok" && json.c && json.c.length > 0) {
          const data: HistoryData = {
            ticker,
            closes: json.c.slice(-520),
            source: "finnhub",
            fetchedAt: Date.now(),
          };
          historyCache.set(ticker, {
            data,
            expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
          });
          return data;
        }
      }
    } catch (err) {
      console.warn(
        `[market-data] Finnhub history failed for ${ticker}:`,
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
      const closes = await fetchCandlesPolygon(ticker, 760);
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

export async function getBasicQuotes(
  tickers: string[]
): Promise<Record<string, QuoteData>> {
  const results = await Promise.allSettled(tickers.map((t) => getBasicQuote(t)));
  const out: Record<string, QuoteData> = {};
  tickers.forEach((ticker, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && r.value !== null) {
      out[ticker] = r.value;
    }
  });
  return out;
}
