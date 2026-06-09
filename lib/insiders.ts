import type { CongressTrade } from "@/types/news.types";

import { fetchCongressTrades as fetchFromPelosi, clearCongressCache } from "./pelositracker";
import { fetchCongressTrades as fetchFromDb } from "./congress";

export function clearInsidersCache(): void {
  clearCongressCache();
}

/**
 * Source switch for the Hot Trades feed. Cut over to the official-source
 * pipeline (Phase 7): the `congress_trades` table is now the default, having
 * been backfilled and cross-validated against pelositracker (our DB is a strict
 * superset of pelositracker's recent data — its gaps were just the 100-row cap).
 *
 *   - default / `CONGRESS_SOURCE=db`     → official-source pipeline
 *   - `CONGRESS_SOURCE=pelosi`           → legacy pelositracker.app (kept as a
 *                                          fallback / reconciliation oracle)
 */
const CONGRESS_SOURCE = process.env.CONGRESS_SOURCE?.toLowerCase();

export async function getHotTrades(portfolioTickers: string[] = []): Promise<CongressTrade[]> {
  if (CONGRESS_SOURCE === "pelosi") return fetchFromPelosi(portfolioTickers);
  return fetchFromDb(portfolioTickers);
}
