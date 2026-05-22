import type { NextApiResponse } from "next";
import { getHotTrades } from "@/lib/insiders";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import type { CongressTrade } from "@/types/news.types";
import { apiHandler } from "@/lib/api-handler";

interface CongressResponse {
  trades: CongressTrade[];
  fetchedAt: number;
}

export default apiHandler(["GET"], async (req, res: NextApiResponse<CongressResponse | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { portfolioService } = await getServicesForUser(user.id);
    const { positions } = await portfolioService.getPositionsSafe();
    const tickers = positions.map(p => p.ticker);
    
    // getHotTrades will try Quiver first, then fallback to Finnhub Insiders for your portfolio
    const trades = await getHotTrades(tickers);
    
    res.status(200).json({ trades, fetchedAt: Date.now() });
  } catch (err) {
    console.error("[api/congress]", err);
    res.status(500).json({ error: "Failed to fetch hot trades data" });
  }
}, "api/congress");
