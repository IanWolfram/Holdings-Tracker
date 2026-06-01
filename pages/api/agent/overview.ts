import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";
import { BROWSER_USER_AGENT, API_TIMEOUT_MS } from "@/lib/constants";

interface OverviewResponse {
  bookValue: number | null;
  holdingsCount: number;
  spx: { value: number; changePercent: number } | null;
  queueCount: number | null;
}

// Fetch the S&P 500 index level from Stooq (^spx). The shared getBasicQuote
// pipeline forces a ".us" equity suffix, so it can't resolve index symbols.
async function fetchSpxIndex(): Promise<OverviewResponse["spx"]> {
  try {
    const res = await fetch("https://stooq.com/q/l/?s=^spx&f=sd2t2ohlcv&h&e=csv", {
      headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "text/csv,text/plain,*/*" },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const lines = (await res.text()).trim().split("\n");
    if (lines.length < 2) return null;
    // Header: Symbol,Date,Time,Open,High,Low,Close,Volume
    const v = lines[1].split(",");
    const open = parseFloat(v[3]);
    const close = parseFloat(v[6]);
    if (Number.isNaN(close) || close === 0) return null;
    const changePercent = open > 0 ? ((close - open) / open) * 100 : 0;
    return { value: close, changePercent };
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
