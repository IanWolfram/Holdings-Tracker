import type { NextApiRequest, NextApiResponse } from "next";
import type { ClassifiedStory } from "@/types/news.types";
import { getServices } from "@/src/registry";

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
    const { newsService } = getServices();
    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("news fetch timeout")), 45_000)
    );
    const stories = await Promise.race([newsService.getNewsForTicker(ticker), deadline]);
    res.status(200).json(stories);
  } catch (err) {
    console.error("[/api/news]", err);
    res.status(500).json({ error: "Failed to fetch news" });
  }
}
