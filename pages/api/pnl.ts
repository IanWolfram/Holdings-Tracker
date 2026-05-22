import type { NextApiResponse } from "next";
import { computeUnrealizedPnL } from "@/lib/pnl";
import type { PnLResult } from "@/lib/pnl";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res: NextApiResponse<PnLResult | { error: string }>) => {
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
}, "api/pnl");
