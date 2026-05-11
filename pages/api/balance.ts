import type { NextApiRequest, NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ cashBalance: number } | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { portfolioService } = await getServicesForUser(user.id);
    const cashBalance = await portfolioService.getCashBalanceSafe();
    res.status(200).json({ cashBalance });
  } catch (err) {
    console.error("[/api/balance]", err);
    res.status(502).json({ error: "Failed to fetch balance" });
  }
}
