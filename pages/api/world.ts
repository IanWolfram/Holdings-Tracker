import type { NextApiResponse } from "next";
import type { WorldData } from "@/types/geo.types";
import { getWorldData } from "@/lib/world-data";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res: NextApiResponse<WorldData | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  try {
    const { portfolioService } = await getServicesForUser(user.id);
    const { positions, mock } = await portfolioService.getPositionsSafe();
    const data = await getWorldData(positions, { mock, userId: user.id });
    return res.status(200).json(data);
  } catch (err) {
    console.error("[/api/world]", err);
    res.status(500).json({ error: "Failed to fetch world data" });
  }
}, "api/world");