import type { NextApiRequest, NextApiResponse } from "next";
import { getPositionsSafe, Position } from "@/lib/etrade";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Position[] | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const positions = await getPositionsSafe();
    res.status(200).json(positions);
  } catch (err) {
    console.error("[/api/positions]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
