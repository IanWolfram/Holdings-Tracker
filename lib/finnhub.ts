export interface NewsArticle {
  headline: string;
  summary: string;
  url: string;
  datetime: number; // unix timestamp
  source: "finnhub";
}

export interface Quote {
  currentPrice: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

import { FINNHUB_BASE_URL, API_TIMEOUT_MS } from "./constants";
import { debug } from "./debug";

const BASE = FINNHUB_BASE_URL;

function requireKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");
  return key;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Fetch company news using direct REST (avoids SDK Cloudflare issues)
 */
export async function fetchFinnhubNews(ticker: string): Promise<NewsArticle[]> {
  const key = requireKey();
  const url = `${BASE}/company-news?symbol=${ticker}&from=${daysAgo(7)}&to=${today()}&token=${key}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) return [];

    const tickerLc = ticker.toLowerCase();
    const seen = new Set<string>();
    const articles: NewsArticle[] = [];

    for (const item of data) {
      const headline = item.headline?.trim() ?? "";
      if (!headline || seen.has(headline)) continue;
      seen.add(headline);

      // Pre-filter: headline or summary must mention the ticker.
      // Finnhub's symbol filter is usually precise but can occasionally
      // return loosely-related articles.
      const text = `${headline} ${item.summary ?? ""}`.toLowerCase();
      if (!text.includes(tickerLc)) continue;

      articles.push({
        headline,
        summary: item.summary?.trim() ?? "",
        url: item.url ?? "",
        datetime: item.datetime ?? 0,
        source: "finnhub",
      });
      if (articles.length >= 50) break;
    }

    return articles;
  } catch (err) {
    console.error(`[finnhub] News fetch error for ${ticker}:`, err);
    return [];
  }
}

/**
 * Fetch real-time stock quote using direct REST (avoids SDK Cloudflare issues)
 */
export async function fetchQuote(ticker: string): Promise<Quote> {
  const key = requireKey();
  const url = `${BASE}/quote?symbol=${ticker}&token=${key}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data || data.c === undefined) {
      throw new Error(`No quote data returned for ${ticker}`);
    }

    return {
      currentPrice: data.c ?? 0,
      change: data.d ?? 0,
      percentChange: data.dp ?? 0,
      high: data.h ?? 0,
      low: data.l ?? 0,
      open: data.o ?? 0,
      previousClose: data.pc ?? 0,
      timestamp: data.t ?? Math.floor(Date.now() / 1000),
    };
  } catch (err) {
    console.error(`[finnhub] Quote fetch error for ${ticker}:`, err);
    throw err;
  }
}
/**
 * Fetch historical stock candles using direct REST for better 2026 compatibility
 */
export async function fetchCandles(
  ticker: string,
  days: number = 90
): Promise<number[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");

  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 24 * 60 * 60;
  const url = `${FINNHUB_BASE_URL}/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${key}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    if (data.s === "ok" && Array.isArray(data.c)) {
      debug("finnhub", `2026 Sync: Fetched ${data.c.length} candles for ${ticker}`);
      return data.c;
    }
    console.warn(`[finnhub] No candles for ${ticker} in 2026 range:`, data.s);
    return [];
  } catch (err) {
    console.error(`[finnhub] 2026 Fetch error for ${ticker}:`, err);
    return [];
  }
}
