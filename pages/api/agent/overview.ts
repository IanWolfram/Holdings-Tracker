import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";
import { getBasicQuote } from "@/lib/market-data";

interface OverviewResponse {
  bookValue: number | null;
  holdingsCount: number;
  spx: { value: number; changePercent: number } | null;
  queueCount: number | null;
}

// S&P 500 proxy via the SPY ETF through the shared quote pipeline (Finnhub).
// Stooq's index CSV endpoint (^spx) is gone, and Finnhub's free tier doesn't
// serve raw index symbols — SPY tracks the index tick-for-tick in percent
// terms, and the UI labels the stat as SPY.
async function fetchSpxIndex(): Promise<OverviewResponse["spx"]> {
  try {
    const quote = await getBasicQuote("SPY");
    if (!quote || !quote.currentPrice) return null;
    return { value: quote.currentPrice, changePercent: quote.changePercent };
  } catch {
    return null;
  }
}

// Live stats for the agent-tab greeting strip. Each field degrades to null
// independently so a slow/failed source never blocks the others.
export default apiHandler(["GET"], async (req, res: NextApiResponse) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const { portfolioService, newsService } = await getServicesForUser(user.id);

  // Positions drive both BOOK and the QUEUE scope.
  let positions: { ticker: string; marketValue: number }[] = [];
  try {
    const result = await portfolioService.getPositionsSafe();
    positions = result.positions ?? [];
  } catch {
    positions = [];
  }

  const bookValue = positions.length
    ? positions.reduce((sum, p) => sum + (p.marketValue ?? 0), 0)
    : null;

  // S&P 500 index level (Stooq ^spx). Degrades to null on failure.
  const spx = await fetchSpxIndex();

  // QUEUE = unanalyzed stories across current holdings. News is cached, so this
  // is cheap on warm cache; allSettled keeps one slow ticker from failing all.
  let queueCount: number | null = null;
  if (positions.length) {
    const counts = await Promise.allSettled(
      positions.map(async (p) => {
        const articles = await newsService.getNewsForTicker(p.ticker);
        return articles.filter((a) => a.isAnalyzed !== true).length;
      }),
    );
    queueCount = counts.reduce(
      (sum, r) => sum + (r.status === "fulfilled" ? r.value : 0),
      0,
    );
  }

  const payload: OverviewResponse = {
    bookValue,
    holdingsCount: positions.length,
    spx,
    queueCount,
  };
  return res.status(200).json(payload);
}, "api/agent/overview");
