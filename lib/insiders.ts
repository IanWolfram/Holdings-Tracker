import type { CongressTrade } from "@/types/news.types";

import { fetchCongressTrades } from "./congress";

/**
 * Entry point for the Hot Trades feed — congressional trades from our
 * official-source pipeline (House Clerk PTRs + Senate eFD → `congress_trades`).
 * Reads by ticker from the DB; see `lib/congress/`.
 */
export async function getHotTrades(portfolioTickers: string[] = []): Promise<CongressTrade[]> {
  return fetchCongressTrades(portfolioTickers);
}
