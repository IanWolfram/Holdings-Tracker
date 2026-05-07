import type { NextApiRequest, NextApiResponse } from "next";
import { computeUnrealizedPnL } from "@/lib/pnl";
import type { PnLResult } from "@/lib/pnl";
import { getServices, getServicesForUser } from "@/src/registry";
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

  const { portfolioService } = process.env.PULSE_SINGLE_USER_MODE === "1"
    ? getServices()
    : await getServicesForUser(user.id);
  const { positions } = await portfolioService.getPositionsSafe(false);
  const unrealizedPnL = computeUnrealizedPnL(positions);
  return res.status(200).json({ realizedPnL: 0, unrealizedPnL, totalPnL: unrealizedPnL });
}
