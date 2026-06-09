import { useState, useCallback } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { CongressTrade } from "@/types/news.types";

export function useCongress() {
  const [congressTrades, setCongressTrades] = useState<Record<string, CongressTrade[]>>({});

  const fetchCongress = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;
    try {
      const upper = tickers.map((ticker) => ticker.toUpperCase());
      const res = await authedFetch(
        `/api/congress?tickers=${encodeURIComponent(upper.join(","))}`,
      );
      if (!res.ok) return;
      const { trades }: { trades: CongressTrade[] } = await res.json();

      // Seed every requested ticker with an empty array so this fetch refreshes
      // exactly the tickers it asked about (clearing any stale trades for them).
      const tickerSet = new Set(upper);
      const byTicker: Record<string, CongressTrade[]> = {};
      for (const ticker of upper) byTicker[ticker] = [];
      for (const trade of trades) {
        if (tickerSet.has(trade.ticker)) byTicker[trade.ticker].push(trade);
      }

      // Merge — don't replace — so a held-tickers fetch and a watchlist fetch
      // don't wipe each other's results.
      setCongressTrades((prev) => ({ ...prev, ...byTicker }));
    } catch {
      // ignore
    }
  }, []);

  return { congressTrades, fetchCongress };
}