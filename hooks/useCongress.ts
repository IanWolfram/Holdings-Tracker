import { useState, useCallback } from "react";
import { fetchCongressTrades } from "@/lib/api/congress-client";
import type { CongressTrade } from "@/types/news.types";

export function useCongress() {
  const [congressTrades, setCongressTrades] = useState<Record<string, CongressTrade[]>>({});

  const fetchCongress = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) return;
    const upper = tickers.map((ticker) => ticker.toUpperCase());
    // Coalesced + cached by the requested ticker set (see congress-client).
    const trades = await fetchCongressTrades(upper);

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
  }, []);

  return { congressTrades, fetchCongress };
}