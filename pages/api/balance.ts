import type { NextApiResponse } from "next";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res: NextApiResponse<{ cashBalance: number } | { error: string }>) => {
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
}, "api/balance");
