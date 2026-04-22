import type { NextApiRequest, NextApiResponse } from "next";
import { computeUnrealizedPnL } from "@/lib/pnl";
import type { PnLResult } from "@/lib/pnl";
import { getServices } from "@/src/registry";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PnLResult | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { portfolioService } = getServices();
  const positions = await portfolioService.getPositionsSafe(false);
  const unrealizedPnL = computeUnrealizedPnL(positions);
  return res.status(200).json({ realizedPnL: 0, unrealizedPnL, totalPnL: unrealizedPnL });
}
