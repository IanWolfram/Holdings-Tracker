import type { CongressTrade } from "@/types/news.types";

const INSIDER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: { data: CongressTrade[]; expiresAt: number } | null = null;

export function clearInsidersCache(): void {
  cache = null;
}

/**
 * Finnhub Insider Transactions shape
 */
interface FinnhubInsiderTrade {
  symbol: string;
  name: string;
  share: number;
  change: number;
  price: number;
  transactionDate: string;
  filingDate: string;
  transactionCode: string; // P=Purchase, S=Sale
}

/**
 * Fetches insider trades from Finnhub for a list of tickers.
 */
export async function getInsiderTrades(tickers: string[]): Promise<CongressTrade[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];

  // Use a small subset to avoid hitting rate limits too hard
  const targetTickers = tickers.slice(0, 10);
  
  try {
    const allTrades = await Promise.all(
      targetTickers.map(async (ticker) => {
        const res = await fetch(
          `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${ticker}&token=${apiKey}`
        );
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data || []) as FinnhubInsiderTrade[];
      })
    );

    const flattened = allTrades.flat();
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    const mapped: CongressTrade[] = flattened
      .map((t, i) => {
        const parseDate = (d: string) =>
          Math.floor(Date.parse(d.includes("T") ? d : `${d}T12:00:00`) / 1000);
        const tradeDate = parseDate(t.transactionDate);
        const filedDate = parseDate(t.filingDate);
        const value = Math.abs(t.change * t.price);
        return {
          id: `insider-${t.symbol}-${t.transactionDate}-${i}`,
          politician: t.name,
          party: "I" as const,
          chamber: "house" as const,
          ticker: t.symbol,
          companyName: t.symbol,
          tradeType: t.transactionCode === "S" ? "sell" as const : "buy" as const,
          assetType: "stock",
          amount: value > 0 ? `$${Math.round(value).toLocaleString()}` : "undisclosed",
          tradeDate,
          filedDate,
          url: `https://www.capitoltrades.com/politicians?search=${encodeURIComponent(t.name)}`,
        };
      })
      .filter((t) => !isNaN(t.tradeDate) && t.tradeDate >= thirtyDaysAgo);

    return mapped.sort((a, b) => b.tradeDate - a.tradeDate);
  } catch (err) {
    console.error("[insiders] Fetch error:", err);
    return [];
  }
}

/**
 * Main entry point for the Hot Trades feed (now solely corporate insiders).
 */
export async function getHotTrades(portfolioTickers: string[] = []): Promise<CongressTrade[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  // Purely insider trades now
  const trades = await getInsiderTrades(portfolioTickers);

  cache = { data: trades, expiresAt: Date.now() + INSIDER_CACHE_TTL_MS };
  return trades;
}
