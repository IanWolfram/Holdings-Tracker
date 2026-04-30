import type { NextApiRequest, NextApiResponse } from "next";
import { getQuote, getHistory } from "@/lib/market-data";
import { getCompanyName } from "@/lib/company-names";
import type { Position } from "@/types/position.types";

interface ProposedTarget {
  ticker: string;
  targetShares?: number;
  targetPrice?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const { targets }: { targets?: ProposedTarget[] } = req.body;
  if (!Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: "targets array required" });
  }

  if (targets.length > 10) {
    return res.status(400).json({ error: "maximum 10 tickers" });
  }

  const results = await Promise.allSettled(
    targets.map(async (target): Promise<Position> => {
      const ticker = target.ticker.toUpperCase().trim();

      const [quote, history, companyName] = await Promise.all([
        getQuote(ticker).catch(() => null),
        getHistory(ticker).catch(() => null),
        getCompanyName(ticker).catch(() => ticker),
      ]);

      const currentPrice = quote?.currentPrice ?? 0;
      const dayChangePct = quote?.changePercent ?? 0;
      const dayChange =
        quote && history && history.closes.length >= 2
          ? currentPrice - history.closes[history.closes.length - 2]
          : 0;

      const targetShares = target.targetShares;
      const targetPrice = target.targetPrice;

      const marketValue =
        targetShares && currentPrice ? targetShares * currentPrice : 0;
      const gainLoss =
        targetShares && targetPrice && currentPrice
          ? (currentPrice - targetPrice) * targetShares
          : 0;
      const pricePaid = targetPrice ?? 0;

      return {
        ticker,
        description: companyName || ticker,
        quantity: targetShares ?? 0,
        marketValue,
        gainLoss,
        pricePaid,
        currentPrice,
        history: history?.closes ?? [],
        dayChange,
        dayChangePct,
        isProposed: true,
        targetShares,
        targetPrice,
        addedAt: Date.now(),
      };
    })
  );

  const positions: Position[] = results
    .filter(
      (r): r is PromiseFulfilledResult<Position> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);

  return res.status(200).json(positions);
}