import type { NextApiRequest, NextApiResponse } from "next";
import { computeUnrealizedPnL } from "@/lib/pnl";
import type { PnLResult } from "@/lib/pnl";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PnLResult | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { portfolioService } = await getServicesForUser(user.id);
    const { positions } = await portfolioService.getPositionsSafe(false);
    const unrealizedPnL = computeUnrealizedPnL(positions);
    return res.status(200).json({ realizedPnL: 0, unrealizedPnL, totalPnL: unrealizedPnL });
  } catch (err) {
    console.error("[pnl] Error computing P&L:", err);
    return res.status(500).json({ error: "Failed to compute P&L" });
  }
}
