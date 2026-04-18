import type { NextApiRequest, NextApiResponse } from "next";
import type { Position } from "@/types/position.types";
import { getQuote, getHistory } from "@/lib/market-data";
import { getServices } from "@/src/registry";

async function enrichWithRealPrices(positions: Position[]): Promise<Position[]> {
  const results = await Promise.allSettled(
    positions.map(async (pos) => {
      const [quoteResult, historyResult] = await Promise.allSettled([
        getQuote(pos.ticker),
        getHistory(pos.ticker),
      ]);

      const quote = quoteResult.status === "fulfilled" ? quoteResult.value : null;
      const history = historyResult.status === "fulfilled" ? historyResult.value : null;

      if (!quote) return pos;

      const newPrice = quote.currentPrice;
      return {
        ...pos,
        currentPrice: newPrice,
        marketValue: newPrice * pos.quantity,
        gainLoss: (newPrice - pos.pricePaid) * pos.quantity,
        history: history ? history.closes : pos.history,
      };
    })
  );

  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : positions[i]
  );
}

async function enrichWithHistory(positions: Position[]): Promise<Position[]> {
  const results = await Promise.allSettled(
    positions.map(async (pos) => {
      if (pos.history && pos.history.length > 0) return pos;
      const h = await getHistory(pos.ticker).catch(() => null);
      return h ? { ...pos, history: h.closes } : pos;
    })
  );
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : positions[i]
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Position[] | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { portfolioService } = getServices();
    const isRefresh = req.query.refresh === "true";
    const positions = await portfolioService.getPositionsSafe(isRefresh);
    const isMock = process.env.ETRADE_ENV === "mock";

    if (isMock) {
      const enriched = await enrichWithRealPrices(positions);
      return res.status(200).json(enriched);
    }

    const enriched = await enrichWithHistory(positions);
    res.status(200).json(enriched);
  } catch (err) {
    console.error("[/api/positions]", err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
}
