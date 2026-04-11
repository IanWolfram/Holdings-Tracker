import type { NextApiRequest, NextApiResponse } from "next";
import { getNewsForTicker, ClassifiedStory } from "@/lib/news";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClassifiedStory[] | { error: string }>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ticker = typeof req.query.ticker === "string" ? req.query.ticker.toUpperCase() : "";
  if (!ticker) {
    return res.status(400).json({ error: "ticker query param required" });
  }

  try {
    const stories = await getNewsForTicker(ticker);
    res.status(200).json(stories);
  } catch (err) {
    console.error("[/api/news]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
}
