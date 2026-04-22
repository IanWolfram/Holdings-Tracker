import type { NextApiRequest, NextApiResponse } from "next";
import type { Position } from "@/types/position.types";
import { getQuote, getHistory } from "@/lib/market-data";
import { getServices } from "@/src/registry";
import { fetchCompanyProfile } from "@/lib/company-profile";
import { withSyntheticHistory } from "@/src/mappers/positionMapper";

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
      const h = await getHistory(pos.ticker).catch(() => null);
      return h ? { ...pos, history: h.closes } : pos;
    })
  );
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : positions[i]
  );
}

async function enrichWithCompanyNames(positions: Position[]): Promise<Position[]> {
  const results = await Promise.allSettled(
    positions.map(async (pos) => {
      // Only fetch if description is missing or equals the ticker (E*TRADE limitation)
      if (pos.description && pos.description !== pos.ticker) return pos;
      try {
        const profile = await fetchCompanyProfile(pos.ticker);
        if (profile?.name && profile.name !== pos.ticker) {
          return { ...pos, description: profile.name };
        }
      } catch {
        // silently keep original description
      }
      return pos;
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
      const withPrices = await enrichWithRealPrices(positions);
      const withNames = await enrichWithCompanyNames(withPrices);
      return res.status(200).json(withNames);
    }

    const withHistory = await enrichWithHistory(positions);
    const withFallback = withSyntheticHistory(withHistory);
    const withNames = await enrichWithCompanyNames(withFallback);
    res.status(200).json(withNames);
  } catch (err) {
    console.error("[/api/positions]", err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
}
