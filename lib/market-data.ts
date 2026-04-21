import { fetchStooqQuote } from "./stooq";
import { fetchYahooHistory } from "./yahoo-finance";
import { fetchCandlesPolygon } from "./polygon";
import { NEWS_CACHE_TTL_MS, ACCOUNT_CACHE_TTL_MS } from "./constants";
import type { QuoteData, HistoryData } from "@/types/market-data.types";

const quoteCache = new Map<string, { data: QuoteData; expiresAt: number }>();
const historyCache = new Map<string, { data: HistoryData; expiresAt: number }>();

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

export async function getHistory(ticker: string): Promise<HistoryData | null> {
  const cached = historyCache.get(ticker);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Primary: Polygon.io (requires POLYGON_API_KEY)
  try {
    const closes = await fetchCandlesPolygon(ticker, 90);
    if (closes.length > 0) {
      const data: HistoryData = { ticker, closes, source: "polygon", fetchedAt: Date.now() };
      historyCache.set(ticker, { data, expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS });
      return data;
    }
  } catch (err) {
    console.warn(`[market-data] Polygon history failed for ${ticker}:`, (err as Error).message);
  }

  // Fallback: Yahoo Finance
  try {
    const data = await fetchYahooHistory(ticker);
    historyCache.set(ticker, {
      data,
      expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS,
    });
    return data;
  } catch (err) {
    console.warn(
      `[market-data] Yahoo history failed for ${ticker}:`,
      (err as Error).message
    );
    return null;
  }
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
