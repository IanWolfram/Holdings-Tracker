import type { NextApiResponse } from "next";
import type { ClassifiedStory } from "@/types/news.types";
import { getServicesForUser } from "@/src/registry";
import { requireUser } from "@/lib/auth/requireUser";
import { apiHandler } from "@/lib/api-handler";

export default apiHandler(["GET"], async (req, res: NextApiResponse<ClassifiedStory[] | { error: string }>) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const ticker = typeof req.query.ticker === "string" ? req.query.ticker.toUpperCase() : "";
  if (!ticker) {
    return res.status(400).json({ error: "ticker query param required" });
  }

  const { newsService } = await getServicesForUser(user.id);

  try {
    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("news fetch timeout")), 20_000)
    );
    const stories = await Promise.race([newsService.getNewsForTicker(ticker), deadline]);
    res.status(200).json(stories);
  } catch (err) {
    console.error("[/api/news]", err);
    // Fall back to whatever's in the cache — far better than a 5-minute spinner.
    const cached = newsService.getCachedNews(ticker);
    if (cached && cached.length > 0) {
      res.status(200).json(cached);
      return;
    }
    res.status(504).json({ error: "Failed to fetch news" });
  }
}, "api/news");
