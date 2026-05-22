import type { NextApiResponse } from "next";
import { forceRefreshWorldData } from "@/lib/world-data";
import { requirePremiumAccess } from "@/lib/license";
import { requireUser } from "@/lib/auth/requireUser";
import { getServicesForUser } from "@/src/registry";
import { apiHandler } from "@/lib/api-handler";

type Response =
  | { success: true; positions: number; refreshedAt: string }
  | { success: false; error: string };

export default apiHandler(["POST"], async (req, res: NextApiResponse<Response>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const access = await requirePremiumAccess();
  if (!access.ok) {
    return res.status(access.statusCode).json({ success: false, error: access.error });
  }

  try {
    const { portfolioService } = await getServicesForUser(user.id);
    const { positions } = await portfolioService.getPositionsSafe();
    await forceRefreshWorldData(positions, { userId: user.id });
    return res.status(200).json({
      success: true,
      positions: positions.length,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[world-refresh] Failed:", message);
    return res.status(503).json({ success: false, error: message });
  }
}, "api/world-refresh");
