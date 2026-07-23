import type { CongressTrade } from "@/types/news.types";

import { fetchCongressTrades, fetchRecentCongressTrades, fetchCongressTradesByPolitician } from "./congress";

/**
 * Ticker-scoped congressional trades — overlap with specific holdings/watchlist
 * tickers, from our official-source pipeline (House Clerk PTRs + Senate eFD →
 * `congress_trades`). See `lib/congress/`.
 */
export async function getHotTrades(portfolioTickers: string[] = []): Promise<CongressTrade[]> {
  return fetchCongressTrades(portfolioTickers);
}

/**
 * General congressional-trade feed — most-recent trades across all tickers,
 * independent of holdings. Powers the Hot tab discovery feed and the nav badge,
 * which must not go empty just because the portfolio doesn't overlap filings.
 */
export async function getRecentHotTrades(limit?: number): Promise<CongressTrade[]> {
  return fetchRecentCongressTrades(limit);
}

/**
 * All of a single politician's congressional trades by name — powers the Hot tab
 * search and watchlist, which must surface a tracked person's filings even when
 * they predate the recent discovery feed.
 */
export async function getTradesByPolitician(name: string): Promise<CongressTrade[]> {
  return fetchCongressTradesByPolitician(name);
}
