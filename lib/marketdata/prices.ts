import { getQuote as getCoreQuote } from "../market-data";
import { fetchOHLCPolygon } from "../polygon";
import {
  YAHOO_HEADERS,
  FINNHUB_BASE_URL,
  API_TIMEOUT_MS,
} from "../constants";

const QUOTE_CACHE_TTL_MS = 60 * 1000;
const BARS_CACHE_TTL_MS = 60 * 60 * 1000;

export interface DailyBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketQuote {
  ticker: string;
  price: number;
  change1d: number | null;
  change5d: number | null;
  change30d: number | null;
  return52wHigh: number | null;
  rsi14: number | null;
  atr14: number | null;
  asOf: string;
}

const quoteCache = new Map<string, { data: MarketQuote; expiresAt: number }>();
const barsCache = new Map<string, { data: DailyBar[]; expiresAt: number }>();
const barsInflight = new Map<string, Promise<DailyBar[]>>();

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pctChange(current: number, prior: number | null): number | null {
  if (prior === null || !Number.isFinite(prior) || prior === 0) return null;
  return round(((current - prior) / prior) * 100, 2);
}

function sliceRecent<T>(arr: T[], count: number): T[] {
  if (count <= 0) return [];
  if (arr.length <= count) return arr;
  return arr.slice(arr.length - count);
}

function yahooRangeForDays(days: number): string {
  if (days <= 90) return "6mo";
  if (days <= 180) return "1y";
  if (days <= 365) return "2y";
  return "5y";
}

function dedupeAndSortBars(bars: DailyBar[]): DailyBar[] {
  const byDate = new Map<string, DailyBar>();
  for (const bar of bars) {
    byDate.set(bar.date, bar);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchYahooDailyBars(ticker: string, days: number): Promise<DailyBar[]> {
  const range = yahooRangeForDays(days);
  // query1 is heavily rate-limited; query2 typically stays available. Try both.
  const hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];

  let lastError: Error | null = null;
  let res: Response | null = null;
  for (const host of hosts) {
    const url =
      `https://${host}/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?interval=1d&range=${range}`;
    try {
      const attempt = await fetch(url, {
        headers: YAHOO_HEADERS,
        signal: AbortSignal.timeout(12_000),
      });
      if (attempt.ok) {
        res = attempt;
        break;
      }
      lastError = new Error(`Yahoo chart HTTP ${attempt.status} (${host})`);
    } catch (err) {
      lastError = err as Error;
    }
  }
  if (!res) {
    throw lastError ?? new Error("Yahoo chart unreachable");
  }

  const json = (await res.json()) as {
    chart: {
      result:
        | Array<{
            timestamp?: number[];
            indicators?: {
              quote?: Array<{
                open?: Array<number | null>;
                high?: Array<number | null>;
                low?: Array<number | null>;
                close?: Array<number | null>;
                volume?: Array<number | null>;
              }>;
            };
          }>
        | null;
      error?: { code?: string; description?: string } | null;
    };
  };

  if (json.chart.error) {
    throw new Error(json.chart.error.description ?? "Unknown Yahoo chart error");
  }

  const first = json.chart.result?.[0];
  const ts = first?.timestamp ?? [];
  const quote = first?.indicators?.quote?.[0];
  const open = quote?.open ?? [];
  const high = quote?.high ?? [];
  const low = quote?.low ?? [];
  const close = quote?.close ?? [];
  const volume = quote?.volume ?? [];

  const bars: DailyBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = open[i];
    const h = high[i];
    const l = low[i];
    const c = close[i];
    if (
      typeof o !== "number" ||
      typeof h !== "number" ||
      typeof l !== "number" ||
      typeof c !== "number"
    ) {
      continue;
    }
    if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) {
      continue;
    }
    bars.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: typeof volume[i] === "number" && Number.isFinite(volume[i]) ? Number(volume[i]) : 0,
    });
  }

  if (bars.length === 0) {
    throw new Error(`No Yahoo bars for ${ticker}`);
  }

  return dedupeAndSortBars(bars);
}

async function fetchFinnhubDailyBars(ticker: string, days: number): Promise<DailyBar[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY is not set");

  const to = Math.floor(Date.now() / 1000);
  const from = to - Math.max(days * 2, 365) * 86_400;
  const url =
    `${FINNHUB_BASE_URL}/stock/candle?symbol=${encodeURIComponent(ticker)}` +
    `&resolution=D&from=${from}&to=${to}&token=${apiKey}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Finnhub candles HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    s?: string;
    t?: number[];
    o?: number[];
    h?: number[];
    l?: number[];
    c?: number[];
    v?: number[];
  };

  if (json.s !== "ok") {
    throw new Error(`Finnhub candles status ${json.s ?? "unknown"}`);
  }

  const ts = json.t ?? [];
  const o = json.o ?? [];
  const h = json.h ?? [];
  const l = json.l ?? [];
  const c = json.c ?? [];
  const v = json.v ?? [];

  const bars: DailyBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    if ([o[i], h[i], l[i], c[i]].some((n) => typeof n !== "number" || !Number.isFinite(n))) {
      continue;
    }
    bars.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: o[i],
      high: h[i],
      low: l[i],
      close: c[i],
      volume: typeof v[i] === "number" && Number.isFinite(v[i]) ? Number(v[i]) : 0,
    });
  }

  if (bars.length === 0) {
    throw new Error(`No Finnhub bars for ${ticker}`);
  }

  return dedupeAndSortBars(bars);
}

function computeRsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= 14; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }

  let avgGain = gain / 14;
  let avgLoss = loss / 14;

  for (let i = 15; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const up = delta > 0 ? delta : 0;
    const down = delta < 0 ? -delta : 0;
    avgGain = (avgGain * 13 + up) / 14;
    avgLoss = (avgLoss * 13 + down) / 14;
  }

  if (avgLoss === 0 && avgGain === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - 100 / (1 + rs), 2);
}

function computeAtr14(bars: DailyBar[]): number | null {
  if (bars.length < 15) return null;

  const trValues: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const current = bars[i];
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose)
    );
    trValues.push(tr);
  }

  if (trValues.length < 14) return null;

  let atr = trValues.slice(0, 14).reduce((sum, v) => sum + v, 0) / 14;
  for (let i = 14; i < trValues.length; i++) {
    atr = (atr * 13 + trValues[i]) / 14;
  }

  return round(atr, 4);
}

async function fetchPolygonDailyBars(ticker: string, days: number): Promise<DailyBar[]> {
  const bars = await fetchOHLCPolygon(ticker, Math.max(days, 390));
  if (bars.length === 0) {
    throw new Error(`No Polygon bars for ${ticker}`);
  }
  return dedupeAndSortBars(bars);
}


async function fetchBarsFromSource(ticker: string, days: number): Promise<DailyBar[]> {
  let firstErr: Error | null = null;

  // Primary: Yahoo (Free, reasonably high limits)
  try {
    return await fetchYahooDailyBars(ticker, days);
  } catch (err) {
    firstErr = err as Error;
  }

  // Secondary: Finnhub (60 calls/min free)
  try {
    return await fetchFinnhubDailyBars(ticker, days);
  } catch (err) {
    if (!firstErr) firstErr = err as Error;
  }

  // Final: Polygon (5 calls/min free, serialized)
  try {
    return await fetchPolygonDailyBars(ticker, days);
  } catch (polygonErr) {
    throw firstErr ?? (polygonErr as Error);
  }
}

export async function getDailyBars(ticker: string, days = 390): Promise<DailyBar[]> {
  const normalized = normalizeTicker(ticker);
  const now = Date.now();
  const cached = barsCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return sliceRecent(cached.data, days);
  }

  const existing = barsInflight.get(normalized);
  if (existing) {
    const bars = await existing;
    return sliceRecent(bars, days);
  }

  // Historical bars are the source of truth for backfills and calibration.
  const promise = fetchBarsFromSource(normalized, Math.max(days, 390))
    .then((bars) => {
      barsCache.set(normalized, { data: bars, expiresAt: Date.now() + BARS_CACHE_TTL_MS });
      return bars;
    })
    .finally(() => {
      barsInflight.delete(normalized);
    });

  barsInflight.set(normalized, promise);
  const bars = await promise;
  return sliceRecent(bars, days);
}

export async function getQuote(ticker: string): Promise<MarketQuote | null> {
  const normalized = normalizeTicker(ticker);
  const now = Date.now();
  const cached = quoteCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const [coreQuote, bars] = await Promise.all([
    getCoreQuote(normalized).catch(() => null),
    getDailyBars(normalized, 390).catch(() => []),
  ]);

  const fallbackPrice = bars.length > 0 ? bars[bars.length - 1].close : null;
  const price = coreQuote?.currentPrice ?? fallbackPrice;
  if (price === null || !Number.isFinite(price)) {
    return null;
  }

  const prev1d = bars.length >= 2 ? bars[bars.length - 2].close : null;
  const prev5d = bars.length >= 6 ? bars[bars.length - 6].close : null;
  const prev30d = bars.length >= 31 ? bars[bars.length - 31].close : null;

  const lookback52w = sliceRecent(bars, 252);
  const high52w = lookback52w.length > 0
    ? Math.max(...lookback52w.map((b) => b.high))
    : null;

  const closes = bars.map((b) => b.close);
  if (closes.length > 0) {
    closes[closes.length - 1] = price;
  }

  const quote: MarketQuote = {
    ticker: normalized,
    price: round(price, 4),
    change1d: pctChange(price, prev1d),
    change5d: pctChange(price, prev5d),
    change30d: pctChange(price, prev30d),
    return52wHigh:
      high52w && Number.isFinite(high52w) && high52w !== 0
        ? round(((price - high52w) / high52w) * 100, 2)
        : null,
    rsi14: computeRsi14(closes),
    atr14: computeAtr14(sliceRecent(bars, 80)),
    asOf: new Date().toISOString(),
  };

  quoteCache.set(normalized, { data: quote, expiresAt: now + QUOTE_CACHE_TTL_MS });
  return quote;
}