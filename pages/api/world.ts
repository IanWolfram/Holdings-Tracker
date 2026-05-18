import type { NextApiRequest, NextApiResponse } from "next";
import type { WorldData } from "@/types/geo.types";
import { getWorldData } from "@/lib/world-data";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorldData | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
}