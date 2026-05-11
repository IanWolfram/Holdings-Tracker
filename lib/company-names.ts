import { FINNHUB_BASE_URL, API_TIMEOUT_MS } from "./constants";

const BASE_URL = FINNHUB_BASE_URL;

// Permanent in-memory cache — company names don't change
const nameCache = new Map<string, string>();

// Fallback names used when no Finnhub API key is configured
const FALLBACK_NAMES: Record<string, string> = {
  MSFT: "Microsoft",
  AAPL: "Apple",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  TSLA: "Tesla",
  NVDA: "Nvidia",
  META: "Meta",
  NFLX: "Netflix",
  AMD: "AMD",
  INTC: "Intel",
  BR: "Broadridge Financial",
  GLD: "Gold ETF",
  RPI: "Royal Pharma",
  RXD: "ProShares UltraShort Health Care",
  RBLX: "Roblox",
};

export async function getCompanyName(ticker: string): Promise<string> {
  if (nameCache.has(ticker)) return nameCache.get(ticker)!;

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return FALLBACK_NAMES[ticker] ?? ticker;

  try {
    const url = `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(ticker)}&token=${key}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return ticker;

    const data: { name?: string } = await res.json();
    const name = data.name?.trim() || ticker;
    nameCache.set(ticker, name);
    return name;
  } catch {
    return ticker;
  }
}
