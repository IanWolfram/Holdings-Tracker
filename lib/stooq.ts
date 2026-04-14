/**
 * Stooq.com real-time stock quote fetcher — no API key required.
 * Endpoint: https://stooq.com/q/l/?s={ticker}.us&f=sd2t2ohlcv&h&e=csv
 *
 * CSV columns: Symbol,Date,Time,Open,High,Low,Close,Volume
 */

import type { QuoteData } from "@/types/market-data.types";

export async function fetchStooqQuote(ticker: string): Promise<QuoteData> {
  const symbol = `${ticker.toLowerCase()}.us`;
  const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/csv,text/plain,*/*",
    },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Stooq unavailable for ${ticker}: HTTP ${res.status}`);
  }

  const text = await res.text();
  const lines = text.trim().split("\n");

  if (lines.length < 2) {
    throw new Error(`No data returned from Stooq for ${ticker}`);
  }

  // Header: Symbol,Date,Time,Open,High,Low,Close,Volume
  const values = lines[1].split(",");
  if (values.length < 7) {
    throw new Error(`Unexpected Stooq CSV format for ${ticker}: ${lines[1]}`);
  }

  const open = parseFloat(values[3]);
  const high = parseFloat(values[4]);
  const low = parseFloat(values[5]);
  const close = parseFloat(values[6]);

  if (isNaN(close) || close === 0) {
    throw new Error(`Invalid price data from Stooq for ${ticker}`);
  }

  const changePercent = open > 0 ? ((close - open) / open) * 100 : 0;

  return {
    ticker,
    currentPrice: close,
    changePercent,
    dayHigh: high,
    dayLow: low,
    previousClose: open,
    source: "yahoo", // reuse "yahoo" type label for the UI; stooq is the actual source
    fetchedAt: Date.now(),
  };
}
