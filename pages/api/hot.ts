import type { NextApiRequest, NextApiResponse } from "next";
import { getQuotes } from "@/lib/market-data";
import type { QuoteData, HotTicker } from "@/types/market-data.types";

export type { HotTicker };

interface HotResponse {
  tickers: HotTicker[];
  fetchedAt: number;
}

// Fallback list if Yahoo Finance trending fails
const FALLBACK_TICKERS = [
  "NVDA", "TSLA", "AAPL", "MSFT", "GOOGL", "META", "AMZN", "AMD",
  "PLTR", "MSTR", "SOFI", "RIVN", "LCID", "COIN", "MARA", "SMCI",
  "ARM", "HOOD", "UPST", "SOUN",
];

async function fetchTrendingTickers(): Promise<string[]> {
  try {
    const res = await fetch(
      "https://query1.finance.yahoo.com/v1/finance/trending/US?count=20",
      {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Pulse/1.0)" },
        signal: AbortSignal.timeout(6_000),
      }
    );
    if (!res.ok) throw new Error(`Yahoo trending returned ${res.status}`);
    const json = await res.json() as {
      finance?: {
        result?: Array<{ quotes?: Array<{ symbol?: string }> }>;
      };
    };
    const quotes = json?.finance?.result?.[0]?.quotes ?? [];
    const tickers = quotes
      .map((q) => q.symbol)
      .filter((s): s is string => typeof s === "string" && !s.includes("=") && !s.includes("^"))
      .slice(0, 20);
    return tickers.length > 0 ? tickers : FALLBACK_TICKERS;
  } catch {
    return FALLBACK_TICKERS;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HotResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const tickers = await fetchTrendingTickers();
    const quotes: Record<string, QuoteData> = await getQuotes(tickers);

    const hotTickers: HotTicker[] = tickers
      .filter((t) => quotes[t])
      .map((ticker) => {
        const q = quotes[ticker];
        // heatScore: positive momentum only; higher change % = hotter
        const heatScore = Math.max(0, q.changePercent);
        return {
          ticker,
          companyName: ticker, // company name lookup not critical here
          currentPrice: q.currentPrice,
          changePercent: q.changePercent,
          dayHigh: q.dayHigh,
          dayLow: q.dayLow,
          heatScore,
        };
      })
      // Sort by absolute change, then keep positives first
      .sort((a, b) => b.heatScore !== a.heatScore
        ? b.heatScore - a.heatScore
        : Math.abs(b.changePercent) - Math.abs(a.changePercent)
      );

    res.status(200).json({ tickers: hotTickers, fetchedAt: Date.now() });
  } catch (err) {
    console.error("[api/hot]", err);
    res.status(500).json({ error: "Failed to fetch hot tickers" });
  }
}
