import { useState, useCallback } from "react";
import { authedFetch } from "@/lib/api/client-fetch";
import type { CongressTrade } from "@/types/news.types";

export function useCongress() {
  const [congressTrades, setCongressTrades] = useState<Record<string, CongressTrade[]>>({});

  const fetchCongress = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;
    try {
      const res = await authedFetch("/api/congress");
      if (!res.ok) return;
      const { trades }: { trades: CongressTrade[] } = await res.json();
      const tickerSet = new Set(tickers.map((ticker) => ticker.toUpperCase()));
      const byTicker: Record<string, CongressTrade[]> = {};
      for (const trade of trades) {
        if (tickerSet.has(trade.ticker)) {
          if (!byTicker[trade.ticker]) {
            byTicker[trade.ticker] = [];
          }
          byTicker[trade.ticker].push(trade);
        }
      }
      setCongressTrades(byTicker);
    } catch {
      // ignore
    }
  }, []);

  return { congressTrades, fetchCongress };
}