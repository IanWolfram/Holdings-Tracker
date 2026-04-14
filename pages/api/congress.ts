import type { NextApiRequest, NextApiResponse } from "next";
import { getCongressTrades } from "@/lib/congress";
import type { CongressTrade } from "@/types/news.types";

interface CongressResponse {
  trades: CongressTrade[];
  fetchedAt: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CongressResponse | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const trades = await getCongressTrades();
    res.status(200).json({ trades, fetchedAt: Date.now() });
  } catch (err) {
    console.error("[api/congress]", err);
    res.status(500).json({ error: "Failed to fetch congress trades" });
  }
}
