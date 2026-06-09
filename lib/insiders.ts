import type { CongressTrade } from "@/types/news.types";

import { fetchCongressTrades } from "./pelositracker";

const CONGRESS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let cache: { data: CongressTrade[]; expiresAt: number } | null = null;

export function clearInsidersCache(): void {
  cache = null;
}

/**
 * Main entry point for the Hot Trades feed (Congress trades from pelositracker.app).
 */
export async function getHotTrades(portfolioTickers: string[] = []): Promise<CongressTrade[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  const trades = await fetchCongressTrades(portfolioTickers);

  cache = { data: trades, expiresAt: Date.now() + CONGRESS_CACHE_TTL_MS };
  return trades;
}

