import type { NextApiRequest, NextApiResponse } from "next";
import { getPositions } from "@/lib/etrade";
import { getWorldData, invalidateWorldCache } from "@/lib/world-data";

type Response =
  | { success: true; positions: number; refreshedAt: string }
  | { success: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Response>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const positions = await getPositions();
    invalidateWorldCache();
    await getWorldData(positions);
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
}
